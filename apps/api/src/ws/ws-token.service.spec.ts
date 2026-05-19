/**
 * F4.0/F10.1: Security tests for WsTokenService — ephemeral token lifecycle.
 * Verifies single-use consumption, expiration, and hash-only storage.
 */
import { WsTokenService } from './ws-token.service';

// Fake JWT strings for testing — stable session hash detection
const FAKE_JWT_1 = 'eyJhbGciOiJIUzI1NiJ9.session-one.sig1';
const FAKE_JWT_2 = 'eyJhbGciOiJIUzI1NiJ9.session-two.sig2';
const FAKE_JWT_3 = 'eyJhbGciOiJIUzI1NiJ9.session-three.sig3';

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
      const token = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_1);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique tokens for each call', () => {
      const t1 = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_1);
      const t2 = service.issueToken('user-2', 'PROFESOR', FAKE_JWT_2);
      expect(t1).not.toBe(t2);
    });

    it('should invalidate previous token when issuing a new one for same user', () => {
      const t1 = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_1);
      const _t2 = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_1);

      // First token should be invalidated
      const result = service.consumeToken(t1);
      expect(result).toBeNull();
    });
  });

  // ── Token Consumption ──

  describe('consumeToken', () => {
    it('should return user info with jwtHash for a valid token', () => {
      const token = service.issueToken('user-guid-1', 'PROFESOR', FAKE_JWT_1);
      const result = service.consumeToken(token);

      expect(result).not.toBeNull();
      expect(result!.userGuid).toBe('user-guid-1');
      expect(result!.userRole).toBe('PROFESOR');
      // jwtHash should be a 16-char hex string (first 16 chars of SHA-256)
      expect(result!.jwtHash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should return stable jwtHash for the same JWT across multiple issuances', () => {
      // Simulate page refresh: same JWT, new ephemeral token
      const t1 = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_1);
      const r1 = service.consumeToken(t1);

      const t2 = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_1);
      const r2 = service.consumeToken(t2);

      // Same JWT → same jwtHash (this is the core fix for page refresh)
      expect(r1!.jwtHash).toBe(r2!.jwtHash);
    });

    it('should return different jwtHash for different JWTs (new login)', () => {
      const t1 = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_1);
      const r1 = service.consumeToken(t1);

      const t2 = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_2);
      const r2 = service.consumeToken(t2);

      // Different JWT → different jwtHash (detects genuine new login)
      expect(r1!.jwtHash).not.toBe(r2!.jwtHash);
    });

    it('should enforce single-use — second consumption returns null', () => {
      const token = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_1);

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
      const token = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_1);

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
      const token = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_1);

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
      const t1 = service.issueToken('user-1', 'ESTUDIANTE', FAKE_JWT_1);
      const t2 = service.issueToken('user-2', 'PROFESOR', FAKE_JWT_2);
      const t3 = service.issueToken('user-3', 'ADMINISTRADOR', FAKE_JWT_3);

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
