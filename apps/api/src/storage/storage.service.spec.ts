import { StorageService } from './storage.service';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// We test the StorageService in LOCAL mode (no R2 credentials in env)
// This tests validation logic, file URL generation, and magic bytes

describe('StorageService', () => {
  let service: StorageService;
  const createdFiles: string[] = [];

  beforeEach(() => {
    // Clear R2 env vars to force local mode
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_PUBLIC_URL;
    service = new StorageService();
  });

  // Cleanup test-generated files
  afterAll(() => {
    for (const file of createdFiles) {
      const fullPath = path.join(UPLOADS_DIR, file);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
  });

  // ── UPLOAD VALIDATION ──────────────────────────────────

  describe('uploadFromBuffer', () => {
    it('should reject disallowed file extensions', async () => {
      const buffer = Buffer.from('test');

      await expect(service.uploadFromBuffer(buffer, 'malicious.exe')).rejects.toThrow('Tipo de archivo no permitido');
    });

    it('should reject .sh files', async () => {
      const buffer = Buffer.from('#!/bin/bash');

      await expect(service.uploadFromBuffer(buffer, 'script.sh')).rejects.toThrow(BadRequestException);
    });

    it('should reject files over 50MB', async () => {
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB

      await expect(service.uploadFromBuffer(largeBuffer, 'large.pdf')).rejects.toThrow('tamaño máximo');
    });

    it('should accept valid PDF with correct magic bytes', async () => {
      // PDF magic: %PDF
      const pdfBuffer = Buffer.alloc(1024);
      pdfBuffer.write('%PDF-1.4');

      const result = await service.uploadFromBuffer(pdfBuffer, 'document.pdf', 'entregas');
      createdFiles.push(result);

      expect(result).toContain('.pdf');
      expect(result).toContain('entregas/');
    });

    it('should accept valid PNG with correct magic bytes', async () => {
      // PNG magic: 0x89 0x50 0x4E 0x47
      const pngBuffer = Buffer.alloc(1024);
      pngBuffer[0] = 0x89;
      pngBuffer[1] = 0x50;
      pngBuffer[2] = 0x4e;
      pngBuffer[3] = 0x47;

      const result = await service.uploadFromBuffer(pngBuffer, 'photo.png');
      createdFiles.push(result);

      expect(result).toContain('.png');
    });

    it('should reject PNG extension with PDF content (spoofing)', async () => {
      const spoofBuffer = Buffer.alloc(1024);
      spoofBuffer.write('%PDF-1.4');

      await expect(service.uploadFromBuffer(spoofBuffer, 'fake.png')).rejects.toThrow('no coincide con la extensión');
    });

    it('should reject JPEG extension with wrong magic bytes', async () => {
      const fakeJpeg = Buffer.alloc(1024);
      fakeJpeg.write('NOTJPEG');

      await expect(service.uploadFromBuffer(fakeJpeg, 'image.jpg')).rejects.toThrow(BadRequestException);
    });

    it('should allow .txt files (no magic byte check)', async () => {
      const txtBuffer = Buffer.from('Hello, this is a plain text file content for testing');

      const result = await service.uploadFromBuffer(txtBuffer, 'notes.txt');
      createdFiles.push(result);

      expect(result).toContain('.txt');
    });

    it('should generate unique filenames', async () => {
      const buffer = Buffer.alloc(1024);
      buffer.write('%PDF-1.4');

      const result1 = await service.uploadFromBuffer(buffer, 'test.pdf');
      const result2 = await service.uploadFromBuffer(buffer, 'test.pdf');
      createdFiles.push(result1, result2);

      expect(result1).not.toBe(result2);
    });
  });

  // ── FILE URL GENERATION ────────────────────────────────

  describe('getFileUrl', () => {
    it('should return API path in local mode', () => {
      const url = service.getFileUrl('test-file.pdf', 'http://localhost:3200/api');

      expect(url).toBe('http://localhost:3200/api/storage/download/test-file.pdf');
    });

    it('should use /api as default base', () => {
      const url = service.getFileUrl('photo.png');

      expect(url).toBe('/api/storage/download/photo.png');
    });
  });

  // ── CLOUD STORAGE STATE ────────────────────────────────

  describe('isCloudStorageActive', () => {
    it('should return false in local mode', () => {
      expect(service.isCloudStorageActive()).toBe(false);
    });
  });

  // ── DELETE FILE ────────────────────────────────────────

  describe('deleteFile', () => {
    it('should handle null/empty filename gracefully', async () => {
      await expect(service.deleteFile('')).resolves.toBeUndefined();
    });

    it('should handle non-existent file gracefully', async () => {
      await expect(service.deleteFile('nonexistent-abc123.pdf')).resolves.toBeUndefined();
    });
  });
});
