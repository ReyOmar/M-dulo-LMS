import { Controller, Post, Get, Param, Res, Query, StreamableFile, BadRequestException, Req } from '@nestjs/common';
import { StorageService } from './storage.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import * as path from 'path';
import * as fs from 'fs';

@Controller('cursos')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Upload a file via multipart/form-data.
   * Accepts a single file field named 'file'.
   */
  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Post('/upload')
  async uploadFile(@Req() req: any) {
    const data = await req.file();
    if (!data) {
      throw new BadRequestException('No se envió ningún archivo. Usa multipart/form-data con el campo "file".');
    }

    // Read the file into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      throw new BadRequestException('El archivo está vacío.');
    }

    const filename = await this.storageService.uploadFromBuffer(buffer, data.filename || 'file.bin');
    return { filename };
  }

  /**
   * Download a file. Serves from local storage (legacy) or redirects to R2 public URL.
   */
  @Public()
  @Get('/download/:filename')
  async downloadFile(@Param('filename') filename: string, @Query('originalName') originalName: string, @Res({ passthrough: true }) res: any) {
    const sanitized = path.basename(filename);
    if (!sanitized || sanitized !== filename) {
      throw new BadRequestException('Nombre de archivo inválido.');
    }

    // If R2 is active and the file is not local, redirect to R2 public URL
    if (this.storageService.isCloudStorageActive() && !this.storageService.existsLocally(sanitized)) {
      const publicUrl = this.storageService.getFileUrl(sanitized);
      res.redirect(302, publicUrl);
      return;
    }

    // Serve from local storage (legacy files or fallback mode)
    const filePath = this.storageService.getUploadPath(sanitized);
    const stream = fs.createReadStream(filePath);
    
    const ext = sanitized.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) contentType = `image/${ext}`;
    
    const downloadName = originalName ? path.basename(originalName).replace(/"/g, '') : sanitized;

    res.header('Content-Type', contentType);
    res.header('Content-Disposition', `attachment; filename="${downloadName}"`);
    return new StreamableFile(stream);
  }
}
