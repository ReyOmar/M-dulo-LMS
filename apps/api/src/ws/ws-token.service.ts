import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * WsTokenService — Manages short-lived ephemeral tokens for WebSocket connections.
 *
 * Instead of sending the full JWT in the WebSocket URL query string (which leaks
 * into server logs, browser history, and proxy logs), the client exchanges their
 * JWT for a single-use ephemeral token via a POST request, then uses that token
 * to connect to the WebSocket.
 *
 * Security properties:
 * - Tokens are single-use (consumed on first connection)
 * - Tokens expire after 30 seconds
 * - Tokens are cryptographically random (32 bytes hex)
 * - Only the hash is stored server-side (the raw token is only sent to the client)
 * - Automatic cleanup of expired tokens every 60 seconds
 */
interface EphemeralToken {
  /** SHA-256 hash of the raw token */
  tokenHash: string;
  /** User GUID from the JWT */
  userGuid: string;
  /** User role from the JWT */
  userRole: string;
  /** Expiration timestamp (ms since epoch) */
  expiresAt: number;
}

const TOKEN_TTL_MS = 30_000; // 30 seconds
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute

@Injectable()
export class WsTokenService {
  private readonly logger = new Logger(WsTokenService.name);
  /** Map of tokenHash → EphemeralToken */
  private readonly tokens = new Map<string, EphemeralToken>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic cleanup of expired tokens
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  /**
   * Issue a new ephemeral WS token for an authenticated user.
   * The raw token is returned to the caller (to send to the client).
   * Only the hash is stored server-side.
   *
   * @returns The raw ephemeral token (32 bytes, hex-encoded)
   */
  issueToken(userGuid: string, userRole: string): string {
    // Invalidate any existing tokens for this user (one pending token per user)
    for (const [hash, token] of this.tokens.entries()) {
      if (token.userGuid === userGuid) {
        this.tokens.delete(hash);
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    this.tokens.set(tokenHash, {
      tokenHash,
      userGuid,
      userRole,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });

    return rawToken;
  }

  /**
   * Consume an ephemeral token (single-use).
   * Returns the user info if valid, null otherwise.
   * The token is deleted after consumption regardless of outcome.
   */
  consumeToken(rawToken: string): { userGuid: string; userRole: string } | null {
    if (!rawToken) return null;

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const entry = this.tokens.get(tokenHash);

    if (!entry) return null;

    // Always delete — single use
    this.tokens.delete(tokenHash);

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.logger.warn(`Expired WS token consumed by user ${entry.userGuid}`);
      return null;
    }

    return { userGuid: entry.userGuid, userRole: entry.userRole };
  }

  /**
   * Remove all expired tokens from the map.
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [hash, token] of this.tokens.entries()) {
      if (now > token.expiresAt) {
        this.tokens.delete(hash);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} expired WS tokens`);
    }
  }

  /**
   * Cleanup on module destroy.
   */
  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.tokens.clear();
  }
}
