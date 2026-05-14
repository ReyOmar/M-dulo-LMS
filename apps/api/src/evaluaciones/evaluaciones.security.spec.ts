import { EvaluacionesService } from './evaluaciones.service';
import { BadRequestException } from '@nestjs/common';

/**
 * F5.2: Security tests for EvaluacionesService.
 * Validates:
 * - F1.5/F1.6: Professor can only see submissions for their own courses
 * - F3.6: Professor can only grade submissions for their own courses
 * - BUG-02: Student cannot resubmit after passing grade
 */
describe('EvaluacionesService — Security', () => {
  let service: EvaluacionesService;
  let mockPrisma: any;

  const mockStorageService: any = { uploadFromBuffer: jest.fn().mockResolvedValue('entregas/test.pdf') };
  const mockGateway: any = {
    broadcastToRole: jest.fn(),
    broadcast: jest.fn(),
  };
  const mockNotificaciones: any = { crearNotificacion: jest.fn().mockResolvedValue({}) };
  const mockMail: any = {
    sendGradeNotification: jest.fn().mockResolvedValue(undefined),
    sendSubmissionRejected: jest.fn().mockResolvedValue(undefined),
  };
  const mockCertificados: any = { checkCertificateAfterGrading: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    mockPrisma = {
      lms_entregas: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      lms_recursos: { findUnique: jest.fn() },
      lms_cursos: { findMany: jest.fn() },
      lms_progreso_recurso: { findUnique: jest.fn(), create: jest.fn() },
      usuarios: { findUnique: jest.fn(), findMany: jest.fn() },
    };
    service = new EvaluacionesService(
      mockPrisma,
      mockStorageService,
      mockGateway,
      mockNotificaciones,
      mockMail,
      mockCertificados,
    );
  });

  // ── F1.5/F1.6: getTodasEntregasParaTarea ownership ──

  describe('getTodasEntregasParaTarea — F1.5/F1.6', () => {
    it('should allow professor who owns the course to list submissions', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso: { profesor_guid: 'prof-1' } } },
      });
      mockPrisma.lms_entregas.findMany.mockResolvedValue([{ guid: 'entrega-1' }]);

      const result = await service.getTodasEntregasParaTarea('tarea-1', 'prof-1', 'PROFESOR');
      expect(result).toHaveLength(1);
    });

    it('should DENY professor who does NOT own the course', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso: { profesor_guid: 'prof-1' } } },
      });

      await expect(
        service.getTodasEntregasParaTarea('tarea-1', 'prof-OTHER', 'PROFESOR'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should DENY professor when tarea does not exist', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue(null);

      await expect(
        service.getTodasEntregasParaTarea('nonexistent', 'prof-1', 'PROFESOR'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow admin to list submissions for ANY course', async () => {
      mockPrisma.lms_entregas.findMany.mockResolvedValue([{ guid: 'e1' }, { guid: 'e2' }]);

      // Admin path: role !== 'PROFESOR', so no ownership check
      const result = await service.getTodasEntregasParaTarea('tarea-1', 'admin-1', 'ADMINISTRADOR');
      expect(result).toHaveLength(2);
      // Verify lms_recursos.findUnique was NOT called (admin skips ownership)
      expect(mockPrisma.lms_recursos.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── F3.6: calificarEntrega ownership ──

  describe('calificarEntrega — F3.6', () => {
    it('should allow course professor to grade', async () => {
      mockPrisma.lms_entregas.findUnique.mockResolvedValue({
        tarea: { leccion: { modulo: { curso: { profesor_guid: 'prof-1' } } } },
      });
      mockPrisma.lms_entregas.update.mockResolvedValue({
        guid: 'e1',
        tarea_guid: 'tarea-1',
        usuario_guid: 'student-1',
        estado: 'CALIFICADA',
      });
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso: { nota_aprobacion: 3.0 } } },
      });
      mockPrisma.lms_progreso_recurso.findUnique.mockResolvedValue(null);
      mockPrisma.lms_progreso_recurso.create.mockResolvedValue({});
      mockPrisma.usuarios.findUnique.mockResolvedValue({ email: 'test@test.com', nombre: 'Test' });

      const result = await service.calificarEntrega('e1', { calificacion: 4.5 }, 'prof-1', 'PROFESOR');
      expect(result.estado).toBe('CALIFICADA');
    });

    it('should DENY professor who does NOT own the course', async () => {
      mockPrisma.lms_entregas.findUnique.mockResolvedValue({
        tarea: { leccion: { modulo: { curso: { profesor_guid: 'prof-1' } } } },
      });

      await expect(
        service.calificarEntrega('e1', { calificacion: 4.0 }, 'prof-OTHER', 'PROFESOR'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow admin to grade any submission', async () => {
      // Admin path: role !== 'PROFESOR', no ownership check
      mockPrisma.lms_entregas.update.mockResolvedValue({
        guid: 'e1',
        tarea_guid: 'tarea-1',
        usuario_guid: 'student-1',
        estado: 'CALIFICADA',
      });
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso: { nota_aprobacion: 3.0 } } },
      });
      mockPrisma.lms_progreso_recurso.findUnique.mockResolvedValue(null);
      mockPrisma.lms_progreso_recurso.create.mockResolvedValue({});
      mockPrisma.usuarios.findUnique.mockResolvedValue({ email: 'a@a.com', nombre: 'A' });

      const result = await service.calificarEntrega('e1', { calificacion: 4.0 }, 'admin-1', 'ADMINISTRADOR');
      expect(result.estado).toBe('CALIFICADA');
      // Verify findUnique was NOT called for ownership (admin skips)
      expect(mockPrisma.lms_entregas.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── BUG-02: Resubmission block ──

  describe('submitEntrega — BUG-02 resubmission block', () => {
    it('should BLOCK resubmission when already approved', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        guid: 'e1',
        estado: 'CALIFICADA',
        calificacion: 4.5,
      });
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso: { nota_aprobacion: 3.0 } } },
      });

      await expect(
        service.submitEntrega('tarea-1', {
          buffer: Buffer.from('test'),
          nombre_archivo: 'test.pdf',
          usuario_guid: 'student-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should ALLOW resubmission when grade is below passing', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        guid: 'e1',
        estado: 'CALIFICADA',
        calificacion: 2.0,
        tarea_guid: 'tarea-1',
      });
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso: { nota_aprobacion: 3.0, titulo: 'Test', profesor_guid: 'p1' } } },
        titulo: 'Test Task',
      });
      mockPrisma.lms_entregas.update.mockResolvedValue({
        guid: 'e1',
        estado: 'EN_REVISION',
        tarea_guid: 'tarea-1',
      });
      mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Test', apellido: 'User' });

      const result = await service.submitEntrega('tarea-1', {
        buffer: Buffer.from('test'),
        nombre_archivo: 'resubmit.pdf',
        usuario_guid: 'student-1',
      });
      expect(result.estado).toBe('EN_REVISION');
    });
  });
});
