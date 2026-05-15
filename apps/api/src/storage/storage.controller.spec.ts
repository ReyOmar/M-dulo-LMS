import { StorageController } from './storage.controller';
import { ForbiddenException } from '@nestjs/common';

/**
 * F5.1: Security tests for storage download ownership validation.
 * Tests the assertPrivateFileAccess logic that was added in F1.1/F1.2.
 */
describe('StorageController — F1.1/F1.2 Ownership Validation', () => {
  let controller: StorageController;
  let mockPrisma: any;
  let mockStorageService: any;

  const adminUser = { sub: 'admin-guid', role: 'ADMINISTRADOR', email: 'admin@test.com' };
  const profOwner = { sub: 'prof-guid', role: 'PROFESOR', email: 'prof@test.com' };
  const profOther = { sub: 'prof2-guid', role: 'PROFESOR', email: 'prof2@test.com' };
  const studentOwner = { sub: 'student-guid', role: 'ESTUDIANTE', email: 'student@test.com' };
  const studentOther = { sub: 'student2-guid', role: 'ESTUDIANTE', email: 'student2@test.com' };

  beforeEach(() => {
    mockPrisma = {
      lms_entregas: { findFirst: jest.fn() },
      usuarios: { findFirst: jest.fn() },
      lms_certificados: { findFirst: jest.fn() },
      lms_recursos: { findFirst: jest.fn() },
      lms_matriculas: { findUnique: jest.fn() },
    };
    mockStorageService = {
      hasPublicUrl: jest.fn().mockReturnValue(false),
      isCloudStorageActive: jest.fn().mockReturnValue(false),
      existsLocally: jest.fn().mockReturnValue(true),
      getUploadPath: jest.fn().mockReturnValue('/fake/path'),
      getFileUrl: jest.fn(),
    };
    controller = new StorageController(mockStorageService, mockPrisma);
  });

  // Helper to call private method via the download endpoint
  async function callDownloadFile(user: any, rawKey: string) {
    const _req = { params: { '*': rawKey } };
    const _res = {
      header: jest.fn(),
      redirect: jest.fn(),
    };
    // This will throw before trying to serve the file if ownership fails
    return (controller as any).assertPrivateFileAccess(user, rawKey, rawKey.split('/')[0]);
  }

  // ── ADMIN BYPASS ──

  describe('Admin bypass', () => {
    it('should allow admin to access any private file', async () => {
      await expect(callDownloadFile(adminUser, 'entregas/file.pdf')).resolves.toBeUndefined();
      await expect(callDownloadFile(adminUser, 'firmas/sig.png')).resolves.toBeUndefined();
      await expect(callDownloadFile(adminUser, 'certificados/cert.pdf')).resolves.toBeUndefined();
      await expect(callDownloadFile(adminUser, 'recursos/doc.pdf')).resolves.toBeUndefined();
    });
  });

  // ── ENTREGAS ──

  describe('entregas/ folder', () => {
    it('should allow submission owner to download their own file', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        usuario_guid: 'student-guid',
        tarea: { leccion: { modulo: { curso: { profesor_guid: 'prof-guid' } } } },
      });

      await expect(callDownloadFile(studentOwner, 'entregas/file.pdf')).resolves.toBeUndefined();
    });

    it('should allow course professor to download student submission', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        usuario_guid: 'student-guid',
        tarea: { leccion: { modulo: { curso: { profesor_guid: 'prof-guid' } } } },
      });

      await expect(callDownloadFile(profOwner, 'entregas/file.pdf')).resolves.toBeUndefined();
    });

    it('should DENY other student access to submission', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        usuario_guid: 'student-guid',
        tarea: { leccion: { modulo: { curso: { profesor_guid: 'prof-guid' } } } },
      });

      await expect(callDownloadFile(studentOther, 'entregas/file.pdf')).rejects.toThrow(ForbiddenException);
    });

    it('should DENY other professor access to submission', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        usuario_guid: 'student-guid',
        tarea: { leccion: { modulo: { curso: { profesor_guid: 'prof-guid' } } } },
      });

      await expect(callDownloadFile(profOther, 'entregas/file.pdf')).rejects.toThrow(ForbiddenException);
    });

    it('should DENY access to non-existent submission file', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue(null);

      await expect(callDownloadFile(studentOwner, 'entregas/nonexistent.pdf')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── FIRMAS ──

  describe('firmas/ folder', () => {
    it('should allow signature owner to download', async () => {
      mockPrisma.usuarios.findFirst.mockResolvedValue({ guid: 'prof-guid' });

      await expect(callDownloadFile(profOwner, 'firmas/sig.png')).resolves.toBeUndefined();
    });

    it('should DENY other user access to signature', async () => {
      mockPrisma.usuarios.findFirst.mockResolvedValue({ guid: 'prof-guid' });

      await expect(callDownloadFile(profOther, 'firmas/sig.png')).rejects.toThrow(ForbiddenException);
    });

    it('should DENY student access to any signature', async () => {
      mockPrisma.usuarios.findFirst.mockResolvedValue({ guid: 'prof-guid' });

      await expect(callDownloadFile(studentOwner, 'firmas/sig.png')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── CERTIFICADOS ──

  describe('certificados/ folder', () => {
    it('should allow certificate owner to download', async () => {
      mockPrisma.lms_certificados.findFirst.mockResolvedValue({
        usuario_guid: 'student-guid',
        curso: { profesor_guid: 'prof-guid' },
      });

      await expect(callDownloadFile(studentOwner, 'certificados/cert.pdf')).resolves.toBeUndefined();
    });

    it('should allow course professor to download student certificate', async () => {
      mockPrisma.lms_certificados.findFirst.mockResolvedValue({
        usuario_guid: 'student-guid',
        curso: { profesor_guid: 'prof-guid' },
      });

      await expect(callDownloadFile(profOwner, 'certificados/cert.pdf')).resolves.toBeUndefined();
    });

    it('should DENY other student access to certificate', async () => {
      mockPrisma.lms_certificados.findFirst.mockResolvedValue({
        usuario_guid: 'student-guid',
        curso: { profesor_guid: 'prof-guid' },
      });

      await expect(callDownloadFile(studentOther, 'certificados/cert.pdf')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── RECURSOS ──

  describe('recursos/ folder', () => {
    it('should allow enrolled student to access course resource', async () => {
      mockPrisma.lms_recursos.findFirst.mockResolvedValue({
        leccion: { modulo: { curso_guid: 'curso-guid', curso: { profesor_guid: 'prof-guid' } } },
      });
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue({
        usuario_guid: 'student-guid',
        curso_guid: 'curso-guid',
      });

      await expect(callDownloadFile(studentOwner, 'recursos/doc.pdf')).resolves.toBeUndefined();
    });

    it('should allow course professor to access resource', async () => {
      mockPrisma.lms_recursos.findFirst.mockResolvedValue({
        leccion: { modulo: { curso_guid: 'curso-guid', curso: { profesor_guid: 'prof-guid' } } },
      });

      await expect(callDownloadFile(profOwner, 'recursos/doc.pdf')).resolves.toBeUndefined();
    });

    it('should DENY unenrolled student access to resource', async () => {
      mockPrisma.lms_recursos.findFirst.mockResolvedValue({
        leccion: { modulo: { curso_guid: 'curso-guid', curso: { profesor_guid: 'prof-guid' } } },
      });
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue(null);

      await expect(callDownloadFile(studentOther, 'recursos/doc.pdf')).rejects.toThrow(ForbiddenException);
    });

    it('should DENY other professor access to resource', async () => {
      mockPrisma.lms_recursos.findFirst.mockResolvedValue({
        leccion: { modulo: { curso_guid: 'curso-guid', curso: { profesor_guid: 'prof-guid' } } },
      });
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue(null);

      await expect(callDownloadFile(profOther, 'recursos/doc.pdf')).rejects.toThrow(ForbiddenException);
    });
  });
});
