import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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
  async uploadFromBuffer(buffer: Buffer, originalName: string): Promise<string> {
    const ext = path.extname(originalName).toLowerCase() || '.bin';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${ext}`);
    }
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException(`El archivo excede el tamaño máximo permitido (50MB).`);
    }

    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    if (this.useR2 && this.s3Client) {
      // Upload to Cloudflare R2
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: uniqueName,
        Body: buffer,
        ContentType: contentType,
      }));
      this.logger.log(`☁️  Uploaded to R2: ${uniqueName} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    } else {
      // Fallback: save to local uploads directory
      await fs.promises.writeFile(path.join(UPLOADS_DIR, uniqueName), buffer);
      this.logger.log(`💾 Saved locally: ${uniqueName} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    }

    return uniqueName;
  }

  /**
   * Legacy: Upload from Base64 string. 
   * @deprecated Use uploadFromBuffer with multipart upload instead.
   */
  async uploadFile(base64Data: string, originalName: string): Promise<string> {
    const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer = Buffer.from(base64Clean, 'base64');
    return this.uploadFromBuffer(buffer, originalName);
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
    return `${base}/cursos/download/${filename}`;
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
}
