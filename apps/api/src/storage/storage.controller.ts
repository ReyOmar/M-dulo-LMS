import { Controller, Post, Get, Param, Res, Query, StreamableFile, BadRequestException, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { StorageService } from './storage.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import * as path from 'path';
import * as fs from 'fs';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Upload a file via multipart/form-data.
   * Accepts a single file field named 'file'.
   */
  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('/upload')
  async uploadFile(@Req() req: any, @Query('folder') folder?: string) {
    const data = await req.file();
    if (!data) {
      throw new BadRequestException('No se envió ningún archivo. Usa multipart/form-data con el campo "file".');
    }

    // Validate folder param (whitelist to prevent path traversal)
    const ALLOWED_FOLDERS = ['portadas', 'recursos', 'entregas', 'firmas', 'logos'];
    const safeFolder = folder && ALLOWED_FOLDERS.includes(folder) ? folder : undefined;

    // Read the file into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      throw new BadRequestException('El archivo está vacío.');
    }

    const filename = await this.storageService.uploadFromBuffer(buffer, data.filename || 'file.bin', safeFolder);
    return { filename };
  }

  /**
   * Download/serve a file. Public because <img>, <video>, <a> tags
   * cannot send JWT headers — filenames are UUID-based (unguessable).
   *
   * Security model:
   * - Upload: requires ADMINISTRADOR/PROFESOR role (auth protected)
   * - Download: public read (filenames are random UUIDs, not enumerable)
   * - Path traversal: prevented by folder whitelist + basename sanitization
   *
   * Three strategies:
   * 1. R2 with public URL → 302 redirect to CDN
   * 2. R2 without public URL → proxy stream from R2 through API
   * 3. Local file → serve from filesystem
   */
  @Public()
  @Get('/download/*')
  async downloadFile(
    @Req() req: any,
    @Query('originalName') originalName: string,
    @Res({ passthrough: true }) res: any,
  ) {
    // Extract the full key from the URL path (supports 'file.png' and 'folder/file.png')
    const rawKey: string = req.params['*'] || '';
    if (!rawKey) throw new BadRequestException('Nombre de archivo requerido.');

    // Validate each path segment to prevent directory traversal
    const segments = rawKey.split('/');
    const ALLOWED_FOLDERS = ['portadas', 'recursos', 'entregas', 'firmas', 'logos', 'certificados', 'avatars'];

    let sanitizedKey: string;
    if (segments.length === 1) {
      // Legacy flat file: "123-abc.pdf"
      sanitizedKey = path.basename(segments[0]);
    } else if (segments.length === 2 && ALLOWED_FOLDERS.includes(segments[0])) {
      // Folder-prefixed: "portadas/123-abc.png"
      sanitizedKey = `${segments[0]}/${path.basename(segments[1])}`;
    } else {
      throw new BadRequestException('Ruta de archivo inválida.');
    }

    const justFilename = path.basename(sanitizedKey);
    const downloadName = originalName ? path.basename(originalName).replace(/"/g, '') : justFilename;

    // F5.2/F5.3: Determine disposition based on file extension
    // SVG and executable types MUST be served as attachment to prevent XSS
    const fileExt = path.extname(justFilename).toLowerCase();
    const FORCE_DOWNLOAD_EXTS = ['.svg', '.html', '.htm', '.xml'];
    const disposition = FORCE_DOWNLOAD_EXTS.includes(fileExt) ? 'attachment' : 'inline';

    // Strategy 1: R2 with public CDN URL → redirect
    if (this.storageService.hasPublicUrl() && !this.storageService.existsLocally(justFilename)) {
      const publicUrl = this.storageService.getFileUrl(sanitizedKey);
      res.redirect(302, publicUrl);
      return;
    }

    // Strategy 2: R2 without public URL → proxy stream from R2
    if (this.storageService.isCloudStorageActive() && !this.storageService.existsLocally(justFilename)) {
      const r2File = await this.storageService.streamFromR2(sanitizedKey);
      if (r2File) {
        res.header('Content-Type', r2File.contentType);
        res.header('Content-Disposition', `${disposition}; filename="${downloadName}"`);
        res.header('Cache-Control', 'public, max-age=86400');
        // F5.3: Prevent MIME sniffing
        res.header('X-Content-Type-Options', 'nosniff');
        return new StreamableFile(Buffer.from(r2File.buffer));
      }
    }

    // Strategy 3: Serve from local filesystem
    const filePath = this.storageService.getUploadPath(justFilename);
    const stream = fs.createReadStream(filePath);

    const ext = justFilename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) contentType = `image/${ext}`;
    else if (ext === 'svg') contentType = 'image/svg+xml'; // F5.3: SVG gets proper type but forced download

    res.header('Content-Type', contentType);
    res.header('Content-Disposition', `${disposition}; filename="${downloadName}"`);
    res.header('Cache-Control', 'public, max-age=86400');
    res.header('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(stream);
  }
}
