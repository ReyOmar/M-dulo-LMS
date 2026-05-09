import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
  '.txt', '.zip', '.rar', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.mp4', '.mp3', '.svg',
];

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string = '';
  private publicUrl: string = '';
  private useR2: boolean = false;

  constructor() {
    // Ensure local uploads dir exists (for fallback and legacy files)
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    // Initialize R2 if credentials are configured
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME || 'lms-uploads';
    this.publicUrl = process.env.R2_PUBLIC_URL || '';

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.useR2 = true;
      this.logger.log('☁️  Cloudflare R2 storage initialized');
    } else {
      this.logger.warn('⚠️  R2 not configured — using local storage fallback. Set R2_* env vars for production.');
    }
  }

  /**
   * Upload a file from a Buffer (multipart upload).
   * This is the primary upload method for the new multipart flow.
   */
  async uploadFromBuffer(buffer: Buffer, originalName: string, folder?: string): Promise<string> {
    const ext = path.extname(originalName).toLowerCase() || '.bin';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${ext}`);
    }
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException(`El archivo excede el tamaño máximo permitido (50MB).`);
    }

    // F7.5: Validate MIME magic bytes to prevent extension spoofing
    this.validateMagicBytes(buffer, ext);

    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    // In R2, organize files by folder prefix (e.g. "portadas/123-abc.png")
    const r2Key = folder ? `${folder}/${uniqueName}` : uniqueName;
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    if (this.useR2 && this.s3Client) {
      // Upload to Cloudflare R2 with folder prefix
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: r2Key,
        Body: buffer,
        ContentType: contentType,
      }));
      this.logger.log(`☁️  Uploaded to R2: ${r2Key} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    } else {
      // Fallback: save to local uploads directory (flat, no subfolders for simplicity)
      await fs.promises.writeFile(path.join(UPLOADS_DIR, uniqueName), buffer);
      this.logger.log(`💾 Saved locally: ${uniqueName} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    }

    // Return the key with folder prefix so downloads resolve correctly
    return r2Key;
  }

  /**
   * Upload a buffer to R2 with a specific key (no renaming).
   * Used for structured paths like 'certificados/filename.pdf'.
   * Falls back silently if R2 is not configured.
   */
  async uploadToR2WithKey(buffer: Buffer, key: string, contentType = 'application/octet-stream'): Promise<boolean> {
    if (!this.useR2 || !this.s3Client) return false;

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    this.logger.log(`☁️  Uploaded to R2: ${key} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    return true;
  }


  /**
   * Get the public URL for a file.
   * If R2 is configured, returns the CDN URL. Otherwise returns the API download path.
   */
  getFileUrl(filename: string, apiBaseUrl?: string): string {
    if (this.useR2 && this.publicUrl) {
      return `${this.publicUrl}/${filename}`;
    }
    // Fallback: serve through API
    const base = apiBaseUrl || '/api';
    return `${base}/storage/download/${filename}`;
  }

  /**
   * Get the local file path for legacy/fallback downloads.
   */
  getUploadPath(filename: string): string {
    const fullPath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Archivo no encontrado');
    return fullPath;
  }

  /**
   * Check if a file exists locally (for legacy fallback).
   */
  existsLocally(filename: string): boolean {
    return fs.existsSync(path.join(UPLOADS_DIR, filename));
  }

  /**
   * Whether R2 cloud storage is active.
   */
  isCloudStorageActive(): boolean {
    return this.useR2;
  }

  /**
   * R2-02: Delete a file from storage (R2 or local filesystem).
   * Silently ignores if the file doesn't exist.
   */
  async deleteFile(filename: string): Promise<void> {
    if (!filename) return;

    // For R2: use the full key (may include folder prefix like 'entregas/123-abc.docx')
    // For local: use just the basename (flat storage)
    const localName = path.basename(filename);

    if (this.useR2 && this.s3Client) {
      try {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: filename, // Full key including folder prefix
        }));
        this.logger.log(`Deleted from R2: ${filename}`);
      } catch (err) {
        this.logger.warn(`Failed to delete from R2: ${filename}`, err);
      }
    }

    // Always try local cleanup too (might exist as fallback copy)
    const localPath = path.join(UPLOADS_DIR, localName);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
        this.logger.log(`Deleted local file: ${localName}`);
      } catch (err) {
        this.logger.warn(`Failed to delete local file: ${localName}`, err);
      }
    }
  }

  /**
   * F7.5: Validate file magic bytes to prevent extension spoofing.
   * Only checks formats where magic bytes are well-defined.
   * Allows unknown formats (txt, csv, etc.) to pass through.
   */
  private validateMagicBytes(buffer: Buffer, ext: string): void {
    if (buffer.length < 8) return; // Too small to check

    const SIGNATURES: Record<string, number[][]> = {
      '.pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
      '.png': [[0x89, 0x50, 0x4E, 0x47]], // PNG header
      '.jpg': [[0xFF, 0xD8, 0xFF]],
      '.jpeg': [[0xFF, 0xD8, 0xFF]],
      '.gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
      '.zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06]], // PK
      '.webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
      '.mp4': [], // MP4 has variable headers, skip check
      '.mp3': [[0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2], [0x49, 0x44, 0x33]], // MP3 frame sync or ID3
    };

    const expected = SIGNATURES[ext];
    if (!expected || expected.length === 0) return; // No signature to check

    const matches = expected.some(sig =>
      sig.every((byte, i) => buffer[i] === byte)
    );

    if (!matches) {
      this.logger.warn(`Magic byte mismatch for extension ${ext}: got ${buffer.slice(0, 4).toString('hex')}`);
      throw new BadRequestException(
        `El contenido del archivo no coincide con la extensión ${ext}. Posible archivo corrupto o renombrado.`
      );
    }
  }
}
