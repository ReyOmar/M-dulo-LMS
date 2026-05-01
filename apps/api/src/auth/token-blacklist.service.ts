import { Injectable } from '@nestjs/common';

/**
 * In-memory token blacklist service.
 * Tracks revoked users by GUID with the timestamp of revocation.
 * Any JWT issued before the revocation timestamp is considered invalid.
 * 
 * Entries auto-cleanup after 25 hours (tokens expire in 24h).
 */
@Injectable()
export class TokenBlacklistService {
  // Map<user_guid, revoked_at_timestamp_ms>
  private revokedUsers = new Map<string, number>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Auto-cleanup every hour
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Revoke all tokens for a user issued before now.
   */
  revokeUser(guid: string): void {
    this.revokedUsers.set(guid, Date.now());
  }

  /**
   * Check if a user's token is revoked.
   * @param guid - User GUID from JWT payload (sub)
   * @param tokenIssuedAt - JWT `iat` claim (seconds since epoch)
   * @returns true if the token is revoked
   */
  isRevoked(guid: string, tokenIssuedAt: number): boolean {
    const revokedAt = this.revokedUsers.get(guid);
    if (!revokedAt) return false;
    // JWT iat is in seconds, revokedAt is in milliseconds
    return (tokenIssuedAt * 1000) <= revokedAt;
  }

  /**
   * Remove entries older than 25 hours (tokens expire in 24h,
   * so after 25h no valid token from that user can exist).
   */
  private cleanup(): void {
    const cutoff = Date.now() - (25 * 60 * 60 * 1000);
    for (const [guid, revokedAt] of this.revokedUsers) {
      if (revokedAt < cutoff) {
        this.revokedUsers.delete(guid);
      }
    }
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }
}
