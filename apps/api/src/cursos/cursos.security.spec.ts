/**
 * F12.1: IDOR Security Tests
 * F12.4: Business Logic Security Tests
 *
 * These tests verify that the security hardening in the remediation plan
 * actually prevents the attack vectors documented in SECURITY-MATRICES.md.
 */
import { CursosService } from './cursos.service';
import { NotFoundException } from '@nestjs/common';

// ── Mocks ────────────────────────────────────────────────
const mockPrisma = {
  lms_cursos: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  lms_matriculas: {
    findUnique: jest.fn(),
  },
};

describe('CursosService — IDOR & Ownership (F12.1)', () => {
  let service: CursosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CursosService(mockPrisma as any, null as any, null as any, null as any, null as any);
  });

  describe('verificarAccesoCurso', () => {
    it('F12.1: should allow PROFESOR to access own course', async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        profesor_guid: 'prof-guid',
      });

      await expect(service.verificarAccesoCurso('curso-1', 'prof-guid', 'PROFESOR')).resolves.not.toThrow();
    });

    it("F12.1: should DENY PROFESOR access to another professor's course", async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        profesor_guid: 'other-prof-guid',
      });

      await expect(service.verificarAccesoCurso('curso-1', 'prof-guid', 'PROFESOR')).rejects.toThrow(NotFoundException);
    });

    it('F12.1: should allow ESTUDIANTE to access enrolled course', async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        profesor_guid: 'some-prof',
      });
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue({
        usuario_guid: 'student-guid',
        curso_guid: 'curso-1',
      });

      await expect(service.verificarAccesoCurso('curso-1', 'student-guid', 'ESTUDIANTE')).resolves.not.toThrow();
    });

    it('F12.1: should DENY ESTUDIANTE access to non-enrolled course', async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        profesor_guid: 'some-prof',
      });
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue(null);

      await expect(service.verificarAccesoCurso('curso-1', 'ajeno-guid', 'ESTUDIANTE')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('F12.1: should throw NotFoundException for non-existent course', async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue(null);

      await expect(service.verificarAccesoCurso('nonexistent', 'any-guid', 'ESTUDIANTE')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('F12.1: IDOR — error message should NOT reveal course exists', async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        profesor_guid: 'other-prof',
      });

      try {
        await service.verificarAccesoCurso('curso-1', 'attacker', 'PROFESOR');
        fail('Should have thrown');
      } catch (e: any) {
        // Should use NotFoundException (not ForbiddenException) to avoid leaking course existence
        expect(e).toBeInstanceOf(NotFoundException);
        expect(e.message).toContain('no encontrado');
      }
    });
  });
});
