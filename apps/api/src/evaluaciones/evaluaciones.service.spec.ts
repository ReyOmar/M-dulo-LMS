import { Test, TestingModule } from '@nestjs/testing';
import { EvaluacionesService } from './evaluaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LmsGateway } from '../ws/lms.gateway';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MailService } from '../mail/mail.service';
import { CertificadosService } from '../certificados/certificados.service';
import { BadRequestException } from '@nestjs/common';

const mockPrisma = {
  lms_entregas: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  lms_recursos: { findUnique: jest.fn() },
  lms_cursos: { findMany: jest.fn() },
  lms_progreso_recurso: { findUnique: jest.fn(), create: jest.fn() },
  usuarios: { findUnique: jest.fn(), findMany: jest.fn() },
};

const mockStorage = {
  uploadFromBuffer: jest.fn().mockResolvedValue('uploads/test-file.pdf'),
};

const mockGateway = {
  broadcast: jest.fn(),
  broadcastToRole: jest.fn(),
};

const mockNotificaciones = {
  crearNotificacion: jest.fn().mockResolvedValue({}),
};

const mockMail = {
  sendGradeNotification: jest.fn().mockResolvedValue(true),
};

const mockCertificados = {
  checkCertificateAfterGrading: jest.fn().mockResolvedValue(null),
};

describe('EvaluacionesService', () => {
  let service: EvaluacionesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluacionesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: LmsGateway, useValue: mockGateway },
        { provide: NotificacionesService, useValue: mockNotificaciones },
        { provide: MailService, useValue: mockMail },
        { provide: CertificadosService, useValue: mockCertificados },
      ],
    }).compile();

    service = module.get<EvaluacionesService>(EvaluacionesService);
    jest.clearAllMocks();
  });

  // ── SUBMIT ENTREGA ─────────────────────────────────────

  describe('submitEntrega', () => {
    const submitData = {
      buffer: Buffer.from('test'),
      nombre_archivo: 'tarea.pdf',
      usuario_guid: 'student-1',
    };

    it('should create new entrega when none exists', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue(null);
      mockPrisma.lms_entregas.create.mockResolvedValue({
        guid: 'entrega-1',
        tarea_guid: 'tarea-1',
        estado: 'ENTREGADA',
      });

      const result = await service.submitEntrega('tarea-1', submitData);

      expect(result.estado).toBe('ENTREGADA');
      expect(mockStorage.uploadFromBuffer).toHaveBeenCalledWith(
        submitData.buffer,
        submitData.nombre_archivo,
        'entregas',
      );
      expect(mockGateway.broadcastToRole).toHaveBeenCalledWith('submission:new', expect.any(Object), 'PROFESOR');
    });

    it('should update existing entrega on resubmission', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        guid: 'entrega-existing',
        tarea_guid: 'tarea-1',
        estado: 'ENTREGADA',
        calificacion: null,
      });
      mockPrisma.lms_entregas.update.mockResolvedValue({
        guid: 'entrega-existing',
        tarea_guid: 'tarea-1',
        estado: 'ENTREGADA',
      });

      const result = await service.submitEntrega('tarea-1', submitData);

      expect(result.guid).toBe('entrega-existing');
      expect(mockPrisma.lms_entregas.update).toHaveBeenCalled();
    });

    it('should block resubmission when already approved', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        guid: 'entrega-approved',
        tarea_guid: 'tarea-1',
        estado: 'CALIFICADA',
        calificacion: 4.5,
      });
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso: { nota_aprobacion: 3.0 } } },
      });

      await expect(service.submitEntrega('tarea-1', submitData)).rejects.toThrow(BadRequestException);
    });

    it('should allow resubmission when grade was below threshold', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        guid: 'entrega-failed',
        tarea_guid: 'tarea-1',
        estado: 'CALIFICADA',
        calificacion: 2.0,
      });
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso: { nota_aprobacion: 3.0 } } },
        titulo: 'Tarea 1',
      });
      mockPrisma.lms_entregas.update.mockResolvedValue({
        guid: 'entrega-failed',
        tarea_guid: 'tarea-1',
        estado: 'EN_REVISION',
      });
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        nombre: 'Juan',
        apellido: 'Pérez',
      });

      const result = await service.submitEntrega('tarea-1', submitData);

      expect(result.estado).toBe('EN_REVISION');
    });
  });

  // ── GET ENTREGA ────────────────────────────────────────

  describe('getEntrega', () => {
    it('should return entrega by tarea_guid and usuario_guid', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        guid: 'entrega-1',
        estado: 'ENTREGADA',
      });

      const result = await service.getEntrega('tarea-1', 'student-1');

      expect(result).toBeDefined();
      expect(mockPrisma.lms_entregas.findFirst).toHaveBeenCalledWith({
        where: { tarea_guid: 'tarea-1', usuario_guid: 'student-1' },
        select: expect.any(Object),
      });
    });

    it('should return null when no entrega exists', async () => {
      mockPrisma.lms_entregas.findFirst.mockResolvedValue(null);

      const result = await service.getEntrega('tarea-999', 'student-1');

      expect(result).toBeNull();
    });
  });

  // ── CALIFICAR ENTREGA ──────────────────────────────────

  describe('calificarEntrega', () => {
    it('should grade entrega and create progress record if passing', async () => {
      mockPrisma.lms_entregas.update.mockResolvedValue({
        guid: 'entrega-1',
        tarea_guid: 'tarea-1',
        usuario_guid: 'student-1',
        estado: 'CALIFICADA',
        calificacion: 4.0,
      });
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso: { nota_aprobacion: 3.0 } } },
        titulo: 'Tarea 1',
      });
      mockPrisma.lms_progreso_recurso.findUnique.mockResolvedValue(null);
      mockPrisma.lms_progreso_recurso.create.mockResolvedValue({});
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        email: 'student@pesv.com',
        nombre: 'Student',
      });

      const result = await service.calificarEntrega('entrega-1', { calificacion: 4.0 }, 'admin-1', 'ADMINISTRADOR');

      expect(result.estado).toBe('CALIFICADA');
      expect(mockPrisma.lms_progreso_recurso.create).toHaveBeenCalled();
      expect(mockGateway.broadcast).toHaveBeenCalledWith(
        'submission:graded',
        expect.objectContaining({ calificacion: 4.0 }),
        ['student-1'],
      );
    });

    it('should NOT create progress record if grade is below threshold', async () => {
      mockPrisma.lms_entregas.update.mockResolvedValue({
        guid: 'entrega-1',
        tarea_guid: 'tarea-1',
        usuario_guid: 'student-1',
        estado: 'CALIFICADA',
        calificacion: 2.0,
      });
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso: { nota_aprobacion: 3.0 } } },
      });
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);

      await service.calificarEntrega(
        'entrega-1',
        { calificacion: 2.0, comentario: 'Debe mejorar' },
        'admin-1',
        'ADMINISTRADOR',
      );

      expect(mockPrisma.lms_progreso_recurso.create).not.toHaveBeenCalled();
    });

    it('should include comment in the update', async () => {
      mockPrisma.lms_entregas.update.mockResolvedValue({
        guid: 'entrega-1',
        tarea_guid: 'tarea-1',
        usuario_guid: 'student-1',
        estado: 'CALIFICADA',
        calificacion: 3.5,
      });
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso: { nota_aprobacion: 3.0 } } },
      });
      mockPrisma.lms_progreso_recurso.findUnique.mockResolvedValue(null);
      mockPrisma.lms_progreso_recurso.create.mockResolvedValue({});
      mockPrisma.usuarios.findUnique.mockResolvedValue(null);

      await service.calificarEntrega(
        'entrega-1',
        { calificacion: 3.5, comentario: 'Buen trabajo' },
        'admin-1',
        'ADMINISTRADOR',
      );

      expect(mockPrisma.lms_entregas.update).toHaveBeenCalledWith({
        where: { guid: 'entrega-1' },
        data: expect.objectContaining({
          comentario_calificacion: 'Buen trabajo',
          contenido_texto: 'NOTA: 3.5 | Buen trabajo',
        }),
      });
    });
  });
});
