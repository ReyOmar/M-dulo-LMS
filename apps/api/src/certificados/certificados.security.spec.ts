import { ForbiddenException } from '@nestjs/common';
import { CertificadosService } from './certificados.service';

/**
 * F12.1: IDOR tests for certificate access control.
 * Tests validateCertificateAccess ownership enforcement.
 * Uses direct instantiation to avoid full NestJS DI.
 */
describe('CertificadosService — Certificate Access Control (F3.9/F12.1)', () => {
  const mockCert = {
    guid: 'cert-1',
    usuario_guid: 'student-owner',
    curso_guid: 'course-1',
    curso: { titulo: 'Test Course' },
    usuario: { nombre: 'Test', apellido: 'Student' },
    archivo_pdf: 'cert-1.pdf',
  };

  const mockPrisma = {
    lms_cursos: {
      findUnique: jest.fn(),
    },
  };

  let service: CertificadosService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Direct instantiation — only prisma is needed for validateCertificateAccess
    service = new CertificadosService(
      mockPrisma as any,
      { broadcast: jest.fn() } as any,
      { getConfig: jest.fn().mockResolvedValue({}) } as any,
      { create: jest.fn() } as any,
      {} as any,
      {} as any,
      { emit: jest.fn() } as any,
    );
  });

  describe('validateCertificateAccess', () => {
    it('should ALLOW certificate owner to access their own certificate', async () => {
      const user = { sub: 'student-owner', role: 'ESTUDIANTE' };
      await expect(service.validateCertificateAccess(mockCert, user)).resolves.toBeUndefined();
    });

    it('should ALLOW admin to access any certificate', async () => {
      const user = { sub: 'admin-other', role: 'ADMINISTRADOR' };
      await expect(service.validateCertificateAccess(mockCert, user)).resolves.toBeUndefined();
    });

    it('should ALLOW course professor to access certificate', async () => {
      const user = { sub: 'professor-of-course', role: 'PROFESOR' };
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        profesor_guid: 'professor-of-course',
      });

      await expect(service.validateCertificateAccess(mockCert, user)).resolves.toBeUndefined();
      expect(mockPrisma.lms_cursos.findUnique).toHaveBeenCalledWith({
        where: { guid: 'course-1' },
        select: { profesor_guid: true },
      });
    });

    it('should DENY another student from accessing certificate (IDOR)', async () => {
      const user = { sub: 'student-attacker', role: 'ESTUDIANTE' };
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        profesor_guid: 'some-other-prof',
      });

      await expect(service.validateCertificateAccess(mockCert, user)).rejects.toThrow(ForbiddenException);
    });

    it('should DENY professor who does not own the course (IDOR)', async () => {
      const user = { sub: 'professor-other', role: 'PROFESOR' };
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        profesor_guid: 'professor-real-owner',
      });

      await expect(service.validateCertificateAccess(mockCert, user)).rejects.toThrow(ForbiddenException);
    });

    it('should DENY when course not found (edge case)', async () => {
      const user = { sub: 'professor-other', role: 'PROFESOR' };
      mockPrisma.lms_cursos.findUnique.mockResolvedValue(null);

      await expect(service.validateCertificateAccess(mockCert, user)).rejects.toThrow(ForbiddenException);
    });
  });
});
