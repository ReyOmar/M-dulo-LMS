import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.zip',
  '.rar',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.mp4',
  '.mp3',
  '.svg',
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
  // F5.2: SVG served as attachment to prevent inline script execution
  '.svg': 'image/svg+xml',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Allowed storage folders. Any storage key must be either a bare filename
 * or prefixed with one of these folders. Anything else is rejected.
 */
const ALLOWED_STORAGE_FOLDERS = ['portadas', 'logos', 'avatars', 'entregas', 'firmas', 'certificados', 'recursos'];

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

      // SEC: Warn if R2_PUBLIC_URL is set — this exposes private folders
      // (firmas, entregas, certificados) without authentication
      if (this.publicUrl) {
        this.logger.warn(
          '⚠️  R2_PUBLIC_URL is set — this will expose private files publicly! ' +
            'Remove R2_PUBLIC_URL to use API-proxied downloads with JWT validation (recommended).',
        );
      }
    } else {
      this.logger.warn('⚠️  R2 not configured — using local storage fallback. Set R2_* env vars for production.');
    }
  }

  // ════════════════════════════════════════════════════════════════
  // SEC: Centralized storage key validation — prevents path traversal,
  //      arbitrary file access, and directory escape attacks.
  // ════════════════════════════════════════════════════════════════

  /**
   * Validate and normalize a storage key.
   * Prevents path traversal, absolute paths, backslashes, null bytes,
   * and restricts keys to allowed folder prefixes.
   *
   * @returns Normalized, safe key (forward slashes, no traversal)
   * @throws BadRequestException if the key is invalid or malicious
   */
  validateStorageKey(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Clave de archivo inválida.');
    }

    // Reject null bytes (can bypass path checks in some systems)
    if (key.includes('\0')) {
      throw new BadRequestException('Clave de archivo contiene caracteres no permitidos.');
    }

    // Normalize backslashes to forward slashes
    let normalized = key.replace(/\\/g, '/');

    // Reject absolute paths (Unix or Windows)
    if (/^\//.test(normalized) || /^[A-Za-z]:/.test(normalized)) {
      throw new BadRequestException('Rutas absolutas no están permitidas.');
    }

    // Reject directory traversal sequences
    if (normalized.includes('..')) {
      throw new BadRequestException('Secuencias de traversal de directorio no están permitidas.');
    }

    // Split into segments and validate
    const segments = normalized.split('/').filter(Boolean);

    if (segments.length === 0) {
      throw new BadRequestException('Clave de archivo vacía.');
    }

    if (segments.length === 1) {
      // Bare filename — must be just a basename (no path separators after normalization)
      normalized = path.basename(segments[0]);
    } else if (segments.length === 2) {
      // folder/filename format — validate folder is allowed
      const folder = segments[0];
      const filename = path.basename(segments[1]);

      if (!ALLOWED_STORAGE_FOLDERS.includes(folder)) {
        throw new BadRequestException(`Carpeta de almacenamiento no permitida: ${folder}`);
      }

      normalized = `${folder}/${filename}`;
    } else {
      // More than 2 segments — reject
      throw new BadRequestException('Formato de clave de archivo inválido. Use "carpeta/archivo" o "archivo".');
    }

    return normalized;
  }

  /**
   * Validate that a resolved local path stays within UPLOADS_DIR (canonical containment).
   * Prevents symlink attacks and edge cases where path.join might escape the sandbox.
   *
   * @throws BadRequestException if the resolved path escapes UPLOADS_DIR
   */
  private assertContainment(resolvedPath: string): void {
    const canonical = path.resolve(resolvedPath);
    const uploadsCanonical = path.resolve(UPLOADS_DIR);

    if (!canonical.startsWith(uploadsCanonical + path.sep) && canonical !== uploadsCanonical) {
      this.logger.warn(`SEC: Path containment violation — ${canonical} escapes ${uploadsCanonical}`);
      throw new BadRequestException('Acceso a archivo fuera del directorio permitido.');
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
    // Both R2 and local use the same folder structure
    const r2Key = folder ? `${folder}/${uniqueName}` : uniqueName;
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    if (this.useR2 && this.s3Client) {
      // Upload to Cloudflare R2 with folder prefix
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: r2Key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      this.logger.log(`☁️  Uploaded to R2: ${r2Key} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    } else {
      // Fallback: save to local uploads directory with matching folder structure
      const localDir = folder ? path.join(UPLOADS_DIR, folder) : UPLOADS_DIR;
      this.assertContainment(localDir);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      const targetPath = path.join(localDir, uniqueName);
      this.assertContainment(targetPath);
      await fs.promises.writeFile(targetPath, buffer);
      this.logger.log(`💾 Saved locally: ${r2Key} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
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
    // SEC: Validate the key even for R2 uploads
    const safeKey = this.validateStorageKey(key);

    if (!this.useR2 || !this.s3Client) return false;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: safeKey,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    this.logger.log(`☁️  Uploaded to R2: ${safeKey} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
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
   * Resolve the local file path for a key.
   * Checks organized folder path first (e.g., uploads/entregas/file.pdf),
   * then falls back to flat path (uploads/file.pdf) for legacy files.
   */
  getUploadPath(key: string): string {
    // SEC: Validate the key before resolving any paths
    const safeKey = this.validateStorageKey(key);

    // Try organized path first (key may be "entregas/123-abc.pdf")
    const organizedPath = path.join(UPLOADS_DIR, safeKey);
    this.assertContainment(organizedPath);
    if (fs.existsSync(organizedPath) && !fs.statSync(organizedPath).isDirectory()) {
      return organizedPath;
    }

    // Fallback: flat legacy path (just the basename)
    const flatPath = path.join(UPLOADS_DIR, path.basename(safeKey));
    this.assertContainment(flatPath);
    if (fs.existsSync(flatPath)) {
      return flatPath;
    }

    throw new NotFoundException('Archivo no encontrado');
  }

  /**
   * Check if a file exists locally (organized or legacy flat).
   */
  existsLocally(key: string): boolean {
    try {
      // SEC: Validate key before checking filesystem
      const safeKey = this.validateStorageKey(key);

      const organizedPath = path.join(UPLOADS_DIR, safeKey);
      this.assertContainment(organizedPath);
      if (fs.existsSync(organizedPath) && !fs.statSync(organizedPath).isDirectory()) {
        return true;
      }
      const flatPath = path.join(UPLOADS_DIR, path.basename(safeKey));
      this.assertContainment(flatPath);
      return fs.existsSync(flatPath);
    } catch {
      return false;
    }
  }

  /**
   * Whether R2 cloud storage is active.
   */
  isCloudStorageActive(): boolean {
    return this.useR2;
  }

  /**
   * Whether a public CDN URL is configured for direct browser access.
   * If false, the API must proxy/stream files from R2.
   */
  hasPublicUrl(): boolean {
    return this.useR2 && !!this.publicUrl;
  }

  /**
   * Stream a file directly from R2 as a Buffer.
   * Used when R2_PUBLIC_URL is not set — the API proxies the file.
   */
  async streamFromR2(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!this.useR2 || !this.s3Client) return null;

    try {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      if (!response.Body) return null;

      // Convert readable stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const ext = key.split('.').pop()?.toLowerCase() || '';
      const contentType = response.ContentType || MIME_MAP[`.${ext}`] || 'application/octet-stream';

      return { buffer: Buffer.concat(chunks), contentType };
    } catch (err) {
      this.logger.warn(`Failed to stream from R2: ${key}`, err);
      return null;
    }
  }

  /**
   * Delete a file from storage (R2 and/or local filesystem).
   * SEC: Validates key and enforces canonical containment before any delete.
   * Silently ignores if the file doesn't exist.
   */
  async deleteFile(filename: string): Promise<void> {
    if (!filename) return;

    // SEC: Validate and normalize the key — prevents traversal, absolute paths, etc.
    const safeKey = this.validateStorageKey(filename);

    if (this.useR2 && this.s3Client) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: safeKey, // Validated key only
          }),
        );
        this.logger.log(`Deleted from R2: ${safeKey}`);
      } catch (err) {
        this.logger.warn(`Failed to delete from R2: ${safeKey}`, err);
      }
    }

    // Try organized path first, then flat legacy path
    const organizedPath = path.join(UPLOADS_DIR, safeKey);
    const flatPath = path.join(UPLOADS_DIR, path.basename(safeKey));

    for (const localPath of [organizedPath, flatPath]) {
      // SEC: Verify containment before any filesystem operation
      try {
        this.assertContainment(localPath);
      } catch {
        this.logger.warn(`SEC: Blocked delete outside uploads dir: ${localPath}`);
        continue;
      }

      if (fs.existsSync(localPath) && !fs.statSync(localPath).isDirectory()) {
        try {
          fs.unlinkSync(localPath);
          this.logger.log(`Deleted local file: ${localPath}`);
          break; // Only delete once
        } catch (err) {
          this.logger.warn(`Failed to delete local file: ${localPath}`, err);
        }
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
      '.png': [[0x89, 0x50, 0x4e, 0x47]], // PNG header
      '.jpg': [[0xff, 0xd8, 0xff]],
      '.jpeg': [[0xff, 0xd8, 0xff]],
      '.gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
      '.zip': [
        [0x50, 0x4b, 0x03, 0x04],
        [0x50, 0x4b, 0x05, 0x06],
      ], // PK
      '.webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
      '.mp4': [], // MP4 has variable headers, skip check
      '.mp3': [
        [0xff, 0xfb],
        [0xff, 0xf3],
        [0xff, 0xf2],
        [0x49, 0x44, 0x33],
      ], // MP3 frame sync or ID3
    };

    const expected = SIGNATURES[ext];
    if (!expected || expected.length === 0) return; // No signature to check

    const matches = expected.some((sig) => sig.every((byte, i) => buffer[i] === byte));

    if (!matches) {
      this.logger.warn(`Magic byte mismatch for extension ${ext}: got ${buffer.slice(0, 4).toString('hex')}`);
      throw new BadRequestException(
        `El contenido del archivo no coincide con la extensión ${ext}. Posible archivo corrupto o renombrado.`,
      );
    }
  }
}
