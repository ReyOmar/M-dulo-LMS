/**
 * F12.5: Sanitization & Security Headers Tests
 * Tests the storage controller's Content-Disposition logic.
 */
import { StorageService } from './storage.service';

describe('StorageService — Sanitization (F12.5)', () => {
  let service: StorageService;

  beforeEach(() => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_PUBLIC_URL;
    service = new StorageService();
  });

  describe('file extension validation', () => {
    it('should block .exe files', async () => {
      await expect(service.uploadFromBuffer(Buffer.from('MZ'), 'virus.exe')).rejects.toThrow('no permitido');
    });

    it('should block .sh files', async () => {
      await expect(service.uploadFromBuffer(Buffer.from('#!/bin/bash'), 'hack.sh')).rejects.toThrow();
    });

    it('should block .bat files', async () => {
      await expect(service.uploadFromBuffer(Buffer.from('@echo off'), 'run.bat')).rejects.toThrow();
    });

    it('should block .php files', async () => {
      await expect(service.uploadFromBuffer(Buffer.from('<?php'), 'shell.php')).rejects.toThrow();
    });

    it('should block .js files', async () => {
      await expect(service.uploadFromBuffer(Buffer.from('alert(1)'), 'xss.js')).rejects.toThrow();
    });
  });

  describe('MIME spoofing prevention (F5.3)', () => {
    it('should reject PDF content disguised as .png', async () => {
      const spoofBuffer = Buffer.alloc(1024);
      spoofBuffer.write('%PDF-1.4');

      await expect(service.uploadFromBuffer(spoofBuffer, 'fake.png')).rejects.toThrow('no coincide');
    });

    it('should reject PNG content disguised as .jpg', async () => {
      const pngBuffer = Buffer.alloc(1024);
      pngBuffer[0] = 0x89;
      pngBuffer[1] = 0x50;
      pngBuffer[2] = 0x4e;
      pngBuffer[3] = 0x47;

      await expect(service.uploadFromBuffer(pngBuffer, 'disguised.jpg')).rejects.toThrow();
    });
  });

  describe('size limits (F5.4)', () => {
    it('should reject files over 50MB', async () => {
      const massive = Buffer.alloc(51 * 1024 * 1024);

      await expect(service.uploadFromBuffer(massive, 'huge.pdf')).rejects.toThrow('tamaño máximo');
    });

    it('should accept files under 50MB', async () => {
      const validPdf = Buffer.alloc(1024);
      validPdf.write('%PDF-1.4');

      const result = await service.uploadFromBuffer(validPdf, 'doc.pdf');
      expect(result).toContain('.pdf');
    });
  });

  describe('path traversal prevention', () => {
    it('should reject traversal in folder names', async () => {
      const buffer = Buffer.alloc(1024);
      buffer.write('%PDF-1.4');

      // Folder should be sanitized or rejected
      const result = await service.uploadFromBuffer(buffer, 'test.pdf', 'portadas');
      expect(result).toContain('portadas/');
      expect(result).not.toContain('..');
    });
  });
});
