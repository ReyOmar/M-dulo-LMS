import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

@Injectable()
export class StorageService {
  constructor() {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  }

  async uploadFile(base64Data: string, originalName: string): Promise<string> {
    const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.zip', '.rar', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(originalName).toLowerCase() || '.bin';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${ext}`);
    }

    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    
    const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer = Buffer.from(base64Clean, 'base64');

    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new BadRequestException(`El archivo excede el tamaño máximo permitido (10MB).`);
    }
    
    await fs.promises.writeFile(path.join(UPLOADS_DIR, uniqueName), buffer);
    return uniqueName;
  }

  getUploadPath(filename: string): string {
    const fullPath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Archivo no encontrado');
    return fullPath;
  }
}
