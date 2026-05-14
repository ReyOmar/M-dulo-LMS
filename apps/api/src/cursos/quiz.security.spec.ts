/**
 * F12.4: Business Logic Security Tests — Quiz
 * Tests that quiz attempts can't be manipulated.
 */
import { QuizService } from './quiz.service';
import { BadRequestException } from '@nestjs/common';

const mockPrisma = {
  lms_recursos: { findUnique: jest.fn() },
  lms_entregas: {
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  lms_progreso_recurso: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  lms_matriculas: { findUnique: jest.fn() },
  $transaction: jest.fn((cb: any) => cb(mockPrisma)),
};

const mockGateway = { broadcast: jest.fn(), broadcastToRole: jest.fn() };
const mockEventEmitter = { emit: jest.fn() };

describe('QuizService — Business Logic (F12.4)', () => {
  let service: QuizService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuizService(mockPrisma as any, mockGateway as any, mockEventEmitter as any);
  });

  describe('verificarMatricula', () => {
    it('should reject non-enrolled student', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso_guid: 'curso-1' } },
      });
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue(null);

      await expect(service.verificarMatricula('recurso-1', 'student-not-enrolled')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow enrolled student', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        leccion: { modulo: { curso_guid: 'curso-1' } },
      });
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue({
        usuario_guid: 'student-enrolled',
        curso_guid: 'curso-1',
      });

      await expect(service.verificarMatricula('recurso-1', 'student-enrolled')).resolves.not.toThrow();
    });

    it('should reject non-existent resource', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue(null);

      await expect(service.verificarMatricula('fake-recurso', 'any-user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('startQuiz', () => {
    it('should reject non-quiz resource', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        guid: 'recurso-1',
        tipo: 'CONTENIDO',
        quiz_config: null,
      });

      await expect(service.startQuiz('recurso-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject when max attempts reached', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        guid: 'recurso-1',
        tipo: 'TAREA',
        quiz_config: JSON.stringify({ intentos_permitidos: 1, preguntas: [] }),
      });
      // No BORRADOR in progress
      mockPrisma.lms_entregas.findFirst.mockResolvedValue(null);
      // 1 existing graded attempt
      mockPrisma.lms_entregas.count.mockResolvedValue(1);
      // Progress exists (so not stale)
      mockPrisma.lms_progreso_recurso.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.startQuiz('recurso-1', 'user-1')).rejects.toThrow('límite');
    });

    it('should return existing BORRADOR if one exists', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        guid: 'recurso-1',
        tipo: 'TAREA',
        quiz_config: JSON.stringify({ intentos_permitidos: 3, preguntas: [] }),
      });
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        guid: 'entrega-borrador',
        fecha_inicio: new Date(),
      });

      const result = await service.startQuiz('recurso-1', 'user-1');
      expect(result.guid).toBe('entrega-borrador');
      expect(result.success).toBe(true);
    });
  });

  describe('evaluarQuiz — idempotency (F4.1)', () => {
    it('should return already_submitted when no BORRADOR exists', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        guid: 'recurso-1',
        tipo: 'TAREA',
        titulo: '[QUIZ] Test',
        quiz_config: JSON.stringify({
          preguntas: [{ id: 'q1', opciones: [{ id: 'a', es_correcta: true }] }],
        }),
        leccion: { modulo: { curso: { nota_aprobacion: 3.0 } } },
      });

      // updateMany returns 0 = no BORRADOR found (already submitted)
      mockPrisma.lms_entregas.updateMany.mockResolvedValue({ count: 0 });
      // Return recently graded attempt
      mockPrisma.lms_entregas.findFirst.mockResolvedValue({
        calificacion: 4.5,
      });

      const result = await service.evaluarQuiz('recurso-1', 'user-1', { q1: 'a' });
      expect(result.already_submitted).toBe(true);
    });
  });
});
