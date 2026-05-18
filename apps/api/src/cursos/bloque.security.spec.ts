import { BloqueService } from './bloque.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * F5.3/F5.4: Security tests for BloqueService.
 * Validates:
 * - F2.1/F2.2: reorderBloques rejects external GUIDs
 * - Draft-only enforcement: modifications blocked on published courses
 * - Ownership: professor can only modify their own courses
 */
describe('BloqueService — Security', () => {
  let service: BloqueService;
  let mockPrisma: any;

  const profOwner = { sub: 'prof-1', role: 'PROFESOR' as const };
  const profOther = { sub: 'prof-2', role: 'PROFESOR' as const };
  const admin = { sub: 'admin-1', role: 'ADMINISTRADOR' as const };

  beforeEach(() => {
    mockPrisma = {
      lms_cursos: { findUnique: jest.fn() },
      lms_modulos: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
      lms_lecciones: { create: jest.fn() },
      lms_recursos: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((fn) => {
        if (typeof fn === 'function') return fn(mockPrisma);
        return Promise.all(fn);
      }),
    };
    service = new BloqueService(mockPrisma);
  });

  // ── F2.1/F2.2: reorderBloques GUID validation ──

  describe('reorderBloques — F2.1/F2.2 GUID validation', () => {
    const mockModule = {
      curso_guid: 'curso-1',
      curso: { estado: 'BORRADOR', profesor_guid: 'prof-1' },
      lecciones: [{ guid: 'leccion-1' }],
    };

    it('should accept valid GUIDs that belong to the module', async () => {
      mockPrisma.lms_modulos.findUnique.mockResolvedValue(mockModule);
      mockPrisma.lms_recursos.findMany.mockResolvedValue([{ guid: 'r1' }, { guid: 'r2' }, { guid: 'r3' }]);
      mockPrisma.lms_recursos.update.mockResolvedValue({});

      await expect(service.reorderBloques('mod-1', ['r1', 'r2', 'r3'], profOwner)).resolves.toBeDefined();
    });

    it('should REJECT external GUIDs not belonging to the module', async () => {
      mockPrisma.lms_modulos.findUnique.mockResolvedValue(mockModule);
      mockPrisma.lms_recursos.findMany.mockResolvedValue([{ guid: 'r1' }, { guid: 'r2' }]);

      await expect(service.reorderBloques('mod-1', ['r1', 'r2', 'INJECTED-GUID'], profOwner)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should REJECT when all GUIDs are external', async () => {
      mockPrisma.lms_modulos.findUnique.mockResolvedValue(mockModule);
      mockPrisma.lms_recursos.findMany.mockResolvedValue([{ guid: 'r1' }]);

      await expect(service.reorderBloques('mod-1', ['fake-1', 'fake-2'], profOwner)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── Draft enforcement ──

  describe('Draft-only enforcement', () => {
    it('should BLOCK modifications on published courses', async () => {
      mockPrisma.lms_modulos.findUnique.mockResolvedValue({
        curso_guid: 'curso-1',
        curso: { estado: 'PUBLICADO', profesor_guid: 'prof-1' },
        lecciones: [{ guid: 'leccion-1' }],
      });

      await expect(service.reorderBloques('mod-1', ['r1'], profOwner)).rejects.toThrow(BadRequestException);
    });

    it('should BLOCK creating modules on published courses', async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        estado: 'PUBLICADO',
        profesor_guid: 'prof-1',
      });

      await expect(service.createModuloParaCurso('curso-1', { titulo: 'New' }, profOwner)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── Ownership ──

  describe('Professor ownership', () => {
    it("should DENY professor modifying another professor's course", async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        estado: 'BORRADOR',
        profesor_guid: 'prof-1',
      });

      await expect(service.createModuloParaCurso('curso-1', { titulo: 'Hack' }, profOther)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should ALLOW admin to modify any course', async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({
        estado: 'BORRADOR',
        profesor_guid: 'prof-1',
      });
      mockPrisma.lms_modulos.count.mockResolvedValue(0);
      mockPrisma.lms_modulos.create.mockResolvedValue({ guid: 'new-mod' });
      mockPrisma.lms_lecciones.create.mockResolvedValue({});

      await expect(service.createModuloParaCurso('curso-1', { titulo: 'Admin Module' }, admin)).resolves.toBeDefined();
    });

    it('should DENY delete of a resource by non-owner professor', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue({
        guid: 'r1',
        leccion: { modulo: { curso: { estado: 'BORRADOR', profesor_guid: 'prof-1' } } },
      });

      await expect(service.deleteBloque('r1', profOther)).rejects.toThrow(BadRequestException);
    });
  });

  // ── Not Found ──

  describe('Not found handling', () => {
    it('should throw NotFoundException for non-existent module', async () => {
      mockPrisma.lms_modulos.findUnique.mockResolvedValue(null);

      await expect(service.reorderBloques('nonexistent', ['r1'], profOwner)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent resource', async () => {
      mockPrisma.lms_recursos.findUnique.mockResolvedValue(null);

      await expect(service.deleteBloque('nonexistent', profOwner)).rejects.toThrow(NotFoundException);
    });
  });
});
