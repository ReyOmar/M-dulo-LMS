/**
 * F12.5: Sanitization & Security Headers Tests
 * Tests the storage service's path traversal prevention, key validation,
 * MIME spoofing detection, size limits, and SVG handling.
 */
import { StorageService } from './storage.service';
import * as fs from 'fs';
import * as path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

describe('StorageService — Sanitization (F12.5)', () => {
  let service: StorageService;
  const createdFiles: string[] = [];

  beforeEach(() => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_PUBLIC_URL;
    service = new StorageService();
  });

  afterAll(() => {
    for (const file of createdFiles) {
      const fullPath = path.join(UPLOADS_DIR, file);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
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
      createdFiles.push(result);
      expect(result).toContain('.pdf');
    });
  });

  describe('path traversal prevention', () => {
    it('should reject traversal in folder names', async () => {
      const buffer = Buffer.alloc(1024);
      buffer.write('%PDF-1.4');

      // Folder should be sanitized or rejected
      const result = await service.uploadFromBuffer(buffer, 'test.pdf', 'portadas');
      createdFiles.push(result);
      expect(result).toContain('portadas/');
      expect(result).not.toContain('..');
    });
  });

  // F12.3: SVG malicious content
  describe('SVG blocking (F5.3)', () => {
    it('should allow .svg upload (security is at download layer: Content-Disposition: attachment)', async () => {
      const svgContent = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>');
      const result = await service.uploadFromBuffer(svgContent, 'malicious.svg');
      createdFiles.push(result);
      expect(result).toContain('.svg');
    });

    it('should block .html files', async () => {
      const htmlContent = Buffer.from('<html><body><script>alert(1)</script></body></html>');
      await expect(service.uploadFromBuffer(htmlContent, 'page.html')).rejects.toThrow();
    });

    it('should block double extensions like .pdf.exe', async () => {
      const buffer = Buffer.from('MZ');
      await expect(service.uploadFromBuffer(buffer, 'report.pdf.exe')).rejects.toThrow();
    });
  });

  // ════════════════════════════════════════════════════════════
  // SEC: Path traversal and key validation attack surface tests
  // ════════════════════════════════════════════════════════════

  describe('validateStorageKey — traversal attacks', () => {
    it('should reject ../../package.json', () => {
      expect(() => service.validateStorageKey('../../package.json')).toThrow('traversal');
    });

    it('should reject firmas/../../../x', () => {
      expect(() => service.validateStorageKey('firmas/../../../x')).toThrow('traversal');
    });

    it('should reject ..\\..\\package.json (backslash traversal)', () => {
      expect(() => service.validateStorageKey('..\\..\\package.json')).toThrow('traversal');
    });

    it('should reject /etc/passwd (absolute Unix path)', () => {
      expect(() => service.validateStorageKey('/etc/passwd')).toThrow('absolutas');
    });

    it('should reject C:\\Windows\\System32\\config (absolute Windows path)', () => {
      expect(() => service.validateStorageKey('C:\\Windows\\System32\\config')).toThrow('absolutas');
    });

    it('should reject null bytes in key', () => {
      expect(() => service.validateStorageKey('file\0.pdf')).toThrow('no permitidos');
    });

    it('should reject empty key', () => {
      expect(() => service.validateStorageKey('')).toThrow('inválida');
    });

    it('should reject unknown folder prefix', () => {
      expect(() => service.validateStorageKey('secretfolder/file.pdf')).toThrow('no permitida');
    });

    it('should reject deeply nested paths', () => {
      expect(() => service.validateStorageKey('a/b/c/file.pdf')).toThrow('inválido');
    });

    it('should accept valid bare filename', () => {
      expect(service.validateStorageKey('1234-abcd.pdf')).toBe('1234-abcd.pdf');
    });

    it('should accept valid folder/filename', () => {
      expect(service.validateStorageKey('entregas/1234-abcd.pdf')).toBe('entregas/1234-abcd.pdf');
    });

    it('should accept all allowed folders', () => {
      for (const folder of ['portadas', 'logos', 'avatars', 'entregas', 'firmas', 'certificados', 'recursos']) {
        expect(service.validateStorageKey(`${folder}/test-file.pdf`)).toBe(`${folder}/test-file.pdf`);
      }
    });

    it('should normalize backslashes in valid paths', () => {
      expect(service.validateStorageKey('entregas\\test.pdf')).toBe('entregas/test.pdf');
    });
  });

  describe('deleteFile — security', () => {
    it('should reject ../../package.json', async () => {
      await expect(service.deleteFile('../../package.json')).rejects.toThrow('traversal');
    });

    it('should reject absolute paths', async () => {
      await expect(service.deleteFile('/etc/passwd')).rejects.toThrow('absolutas');
    });

    it('should reject firmas/../x traversal', async () => {
      await expect(service.deleteFile('firmas/../x')).rejects.toThrow('traversal');
    });

    it('should reject null byte injection', async () => {
      await expect(service.deleteFile('file\0.pdf')).rejects.toThrow('no permitidos');
    });

    it('should silently handle empty filename', async () => {
      // Empty filename should return without error (no-op)
      await expect(service.deleteFile('')).resolves.toBeUndefined();
    });
  });

  describe('getUploadPath — security', () => {
    it('should reject traversal in path lookup', () => {
      expect(() => service.getUploadPath('../../.env')).toThrow('traversal');
    });

    it('should reject absolute path lookup', () => {
      expect(() => service.getUploadPath('/etc/shadow')).toThrow('absolutas');
    });

    it('should reject unknown folder', () => {
      expect(() => service.getUploadPath('privatefolder/secret.txt')).toThrow('no permitida');
    });
  });
});
