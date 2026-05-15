/**
 * F4.0/F10.1: Security tests for WsTokenService — ephemeral token lifecycle.
 * Verifies single-use consumption, expiration, and hash-only storage.
 */
import { WsTokenService } from './ws-token.service';

describe('WsTokenService — Ephemeral Token Security', () => {
  let service: WsTokenService;

  beforeEach(() => {
    service = new WsTokenService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  // ── Token Issuance ──

  describe('issueToken', () => {
    it('should return a 64-character hex string (32 bytes)', () => {
      const token = service.issueToken('user-1', 'ESTUDIANTE');
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique tokens for each call', () => {
      const t1 = service.issueToken('user-1', 'ESTUDIANTE');
      const t2 = service.issueToken('user-2', 'PROFESOR');
      expect(t1).not.toBe(t2);
    });

    it('should invalidate previous token when issuing a new one for same user', () => {
      const t1 = service.issueToken('user-1', 'ESTUDIANTE');
      const _t2 = service.issueToken('user-1', 'ESTUDIANTE');

      // First token should be invalidated
      const result = service.consumeToken(t1);
      expect(result).toBeNull();
    });
  });

  // ── Token Consumption ──

  describe('consumeToken', () => {
    it('should return user info for a valid token', () => {
      const token = service.issueToken('user-guid-1', 'PROFESOR');
      const result = service.consumeToken(token);

      expect(result).toEqual({
        userGuid: 'user-guid-1',
        userRole: 'PROFESOR',
      });
    });

    it('should enforce single-use — second consumption returns null', () => {
      const token = service.issueToken('user-1', 'ESTUDIANTE');

      const first = service.consumeToken(token);
      expect(first).not.toBeNull();

      const second = service.consumeToken(token);
      expect(second).toBeNull();
    });

    it('should return null for a completely unknown token', () => {
      const result = service.consumeToken('not-a-real-token-at-all');
      expect(result).toBeNull();
    });

    it('should return null for empty token', () => {
      expect(service.consumeToken('')).toBeNull();
    });

    it('should return null for expired token', () => {
      // Use jest to manipulate time
      const token = service.issueToken('user-1', 'ESTUDIANTE');

      // Advance time by 31 seconds (past 30s TTL)
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);

      const result = service.consumeToken(token);
      expect(result).toBeNull();

      jest.restoreAllMocks();
    });
  });

  // ── Security Properties ──

  describe('security properties', () => {
    it('should NOT store the raw token (only hash)', () => {
      const token = service.issueToken('user-1', 'ESTUDIANTE');

      // Access private tokens map via reflection
      const tokensMap = (service as any).tokens as Map<string, any>;

      // Verify no entry contains the raw token
      for (const [_hash, entry] of tokensMap.entries()) {
        expect(entry.tokenHash).not.toBe(token);
        // Hash should be different from raw token
        expect(entry.tokenHash.length).toBe(64);
      }
    });

    it('should handle concurrent token issuance for different users', () => {
      const t1 = service.issueToken('user-1', 'ESTUDIANTE');
      const t2 = service.issueToken('user-2', 'PROFESOR');
      const t3 = service.issueToken('user-3', 'ADMINISTRADOR');

      const r1 = service.consumeToken(t1);
      const r2 = service.consumeToken(t2);
      const r3 = service.consumeToken(t3);

      expect(r1?.userGuid).toBe('user-1');
      expect(r2?.userGuid).toBe('user-2');
      expect(r3?.userGuid).toBe('user-3');
      expect(r1?.userRole).toBe('ESTUDIANTE');
      expect(r2?.userRole).toBe('PROFESOR');
      expect(r3?.userRole).toBe('ADMINISTRADOR');
    });
  });
});
