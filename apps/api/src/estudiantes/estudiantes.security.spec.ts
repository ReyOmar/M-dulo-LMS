import { EstudiantesService } from './estudiantes.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * F5.6: Security tests for EstudiantesService.
 * Validates:
 * - F2.5: getProgresoEstudiante requires enrollment
 * - F2.6: registrarHeartbeat requires enrollment
 * - F2.5b: marcarNotificacionLeida scoped by usuario_guid
 * - marcarRecursoCompletado requires enrollment
 */
describe('EstudiantesService — Security', () => {
  let service: EstudiantesService;
  let mockPrisma: any;

  const mockCertificados: any = { checkCertificateAfterGrading: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    mockPrisma = {
      lms_matriculas: { findUnique: jest.fn() },
      lms_cursos: { findUnique: jest.fn() },
      lms_progreso_recurso: {
        findMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
      },
      lms_entregas: { findMany: jest.fn() },
      lms_recursos: { findUnique: jest.fn() },
      lms_notificaciones: { updateMany: jest.fn() },
      lms_sesion_activa: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new EstudiantesService(mockPrisma, mockCertificados);
  });

  // ── F2.5: Progress requires enrollment ──

  describe('getProgresoEstudiante — F2.5', () => {
    it('should DENY unenrolled student', async () => {
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue(null);

      await expect(service.getProgresoEstudiante('student-1', 'curso-1')).rejects.toThrow(ForbiddenException);
    });

    it('should ALLOW enrolled student', async () => {
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue({
        usuario_guid: 'student-1',
        curso_guid: 'curso-1',
      });
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        guid: 'curso-1',
        modulos: [],
      });
      mockPrisma.lms_progreso_recurso.findMany.mockResolvedValue([]);
      mockPrisma.lms_entregas.findMany.mockResolvedValue([]);

      const result = await service.getProgresoEstudiante('student-1', 'curso-1');
      expect(result).toBeDefined();
      expect(result.completados).toEqual([]);
    });
  });

  // ── F2.6: Heartbeat requires enrollment ──

  describe('registrarHeartbeat — F2.6', () => {
    it('should DENY unenrolled student', async () => {
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue(null);

      await expect(service.registrarHeartbeat('student-1', 'curso-1')).rejects.toThrow(ForbiddenException);
    });

    it('should ALLOW enrolled student (new session)', async () => {
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue({
        usuario_guid: 'student-1',
        curso_guid: 'curso-1',
      });
      mockPrisma.lms_sesion_activa.findFirst.mockResolvedValue(null);
      mockPrisma.lms_sesion_activa.create.mockResolvedValue({ id: 1, duracion_seg: 60 });

      const result = await service.registrarHeartbeat('student-1', 'curso-1');
      expect(result).toBeDefined();
    });
  });

  // ── F2.5b: Notification read — ownership via usuario_guid filter ──

  describe('marcarNotificacionLeida — F2.5b', () => {
    it('should only update notifications belonging to the user', async () => {
      mockPrisma.lms_notificaciones.updateMany.mockResolvedValue({ count: 1 });

      await service.marcarNotificacionLeida(42, 'student-1');

      // Verify the WHERE clause includes usuario_guid
      expect(mockPrisma.lms_notificaciones.updateMany).toHaveBeenCalledWith({
        where: { id: 42, usuario_guid: 'student-1' },
        data: { leida: true },
      });
    });

    it('should not affect other users notifications (count=0 if wrong user)', async () => {
      mockPrisma.lms_notificaciones.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.marcarNotificacionLeida(42, 'wrong-user');
      expect(result.count).toBe(0);
    });
  });

  // ── marcarRecursoCompletado — enrollment validation ──

  describe('marcarRecursoCompletado — enrollment', () => {
    it('should DENY unenrolled student', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso_guid: 'curso-1' } },
      });
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue(null);

      await expect(service.marcarRecursoCompletado('student-1', 'recurso-1')).rejects.toThrow(ForbiddenException);
    });

    it('should DENY when resource does not exist', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue(null);

      await expect(service.marcarRecursoCompletado('student-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should ALLOW enrolled student to mark resource complete', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso_guid: 'curso-1' } },
      });
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue({
        usuario_guid: 'student-1',
        curso_guid: 'curso-1',
      });
      mockPrisma.lms_progreso_recurso.upsert.mockResolvedValue({
        usuario_guid: 'student-1',
        recurso_guid: 'recurso-1',
        completado: true,
      });

      const result = await service.marcarRecursoCompletado('student-1', 'recurso-1');
      expect(result.completado).toBe(true);
    });
  });
});
