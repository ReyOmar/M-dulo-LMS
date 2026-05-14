import { TokenBlacklistService } from './token-blacklist.service';

/**
 * F5.9: Security tests for token blacklist — especially the same-second revocation bug.
 */
describe('TokenBlacklistService — F3.5 Revocation Logic', () => {
  let service: TokenBlacklistService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      lms_token_revocations: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new TokenBlacklistService(mockPrisma);
  });

  afterEach(() => {
    // Clean up interval
    (service as any).onModuleDestroy?.();
  });

  describe('isRevoked', () => {
    it('should return false for unknown user', () => {
      expect(service.isRevoked('unknown-guid', Math.floor(Date.now() / 1000))).toBe(false);
    });

    it('should return true for token issued BEFORE revocation', async () => {
      await service.revokeUser('user-guid');

      // Token issued 10 seconds before the revocation
      const tokenIat = Math.floor(Date.now() / 1000) - 10;
      expect(service.isRevoked('user-guid', tokenIat)).toBe(true);
    });

    it('should return true for token issued in the SAME SECOND as revocation (F3.5 fix)', async () => {
      const now = Math.floor(Date.now() / 1000);
      // Manually set the cache to simulate revocation at exact second
      (service as any).cache.set('user-guid', now);

      // Token also issued at the same second
      expect(service.isRevoked('user-guid', now)).toBe(true);
    });

    it('should return false for token issued AFTER revocation', async () => {
      const revokedAtSec = Math.floor(Date.now() / 1000) - 60;
      (service as any).cache.set('user-guid', revokedAtSec);

      // Token issued 30 seconds after the revocation
      const tokenIat = revokedAtSec + 30;
      expect(service.isRevoked('user-guid', tokenIat)).toBe(false);
    });
  });

  describe('revokeUser', () => {
    it('should persist revocation to database', async () => {
      await service.revokeUser('user-guid');

      expect(mockPrisma.lms_token_revocations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usuario_guid: 'user-guid',
          }),
        }),
      );
    });

    it('should update in-memory cache', async () => {
      await service.revokeUser('user-guid');

      expect(service.isRevoked('user-guid', Math.floor(Date.now() / 1000) - 1)).toBe(true);
    });
  });
});
