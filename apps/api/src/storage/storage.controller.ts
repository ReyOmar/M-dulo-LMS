import { Controller, Post, Get, Param, Res, Body } from '@nestjs/common';
import { StorageService } from './storage.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UploadFileDto } from './dto/upload-file.dto';
import * as path from 'path';
import * as fs from 'fs';

@Controller('cursos')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Post('/upload')
  async uploadFile(@Body() body: UploadFileDto) {
    const filename = await this.storageService.uploadFile(body.base64, body.nombre);
    return { filename };
  }

  @Public()
  @Get('/download/:filename')
  async downloadFile(@Param('filename') filename: string, @Res() res: any) {
    const sanitized = path.basename(filename);
    if (!sanitized || sanitized !== filename) {
      return res.status(400).send({ message: 'Nombre de archivo inválido.' });
    }

    const filePath = this.storageService.getUploadPath(sanitized);
    const stream = fs.createReadStream(filePath);
    
    const ext = sanitized.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) contentType = `image/${ext}`;
    
    res.header('Content-Type', contentType);
    res.header('Content-Disposition', `attachment; filename="${sanitized}"`);
    return res.send(stream);
  }
}
