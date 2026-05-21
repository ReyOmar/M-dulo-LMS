import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * TokenBlacklistService — Persistent JWT revocation using database.
 *
 * F2.1: Migrated from in-memory Map to database-backed `lms_token_revocations` table.
 * This ensures revocations survive server restarts.
 *
 * Design:
 *  - revokeUser(guid) inserts a row with the current timestamp.
 *  - isRevoked(guid, iat) checks if any revocation exists for the user
 *    with a revoked_at timestamp AFTER the token's iat (issued-at).
 *  - Expired revocation rows are cleaned up periodically.
 *
 * In-memory cache layer added for hot-path performance (JwtAuthGuard runs on every request).
 */
@Injectable()
export class TokenBlacklistService implements OnModuleInit {
  private readonly logger = new Logger(TokenBlacklistService.name);

  // In-memory cache: user_guid → latest revocation timestamp (epoch seconds)
  private cache = new Map<string, number>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Load existing revocations into cache on startup
    try {
      const revocations = await this.prisma.lms_token_revocations.findMany({
        where: { expires_at: { gt: new Date() } },
      });
      for (const rev of revocations) {
        const revokedAtSec = Math.floor(rev.revoked_at.getTime() / 1000);
        const existing = this.cache.get(rev.usuario_guid) || 0;
        if (revokedAtSec > existing) {
          this.cache.set(rev.usuario_guid, revokedAtSec);
        }
      }
      this.logger.log(`Token blacklist loaded: ${revocations.length} active revocations cached.`);
    } catch (err) {
      this.logger.error('Failed to load token revocations from DB:', err);
    }

    // Cleanup expired revocations every hour
    this.cleanupInterval = setInterval(
      () => {
        this.prisma.lms_token_revocations
          .deleteMany({ where: { expires_at: { lt: new Date() } } })
          .then((result) => {
            if (result.count > 0) {
              this.logger.log(`Cleaned up ${result.count} expired token revocation(s).`);
              // Also clean the cache
              const now = Math.floor(Date.now() / 1000);
              const maxAge = 25 * 3600; // 25 hours (JWT max lifetime)
              for (const [guid, ts] of this.cache) {
                if (now - ts > maxAge) this.cache.delete(guid);
              }
            }
          })
          .catch((err) => this.logger.error('Token revocation cleanup error:', err));
      },
      60 * 60 * 1000,
    ); // Every hour
  }

  /**
   * Revoke all tokens for a user. Any token issued before this moment is invalid.
   */
  async revokeUser(userGuid: string): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(Date.now() + 25 * 3600 * 1000); // 25h = JWT max lifetime

    // Write to DB for persistence
    await this.prisma.lms_token_revocations.create({
      data: {
        usuario_guid: userGuid,
        revoked_at: now,
        expires_at: expiresAt,
      },
    });

    // Update in-memory cache
    this.cache.set(userGuid, Math.floor(now.getTime() / 1000));

    this.logger.log(`Revoked all tokens for user ${userGuid}`);
  }

  /**
   * Revoke all tokens for a user issued before a specific timestamp.
   * Used by login to revoke previous sessions while keeping the new token valid.
   * @param revokedBefore - Tokens issued at or before this time will be invalidated
   */
  async revokeUserBefore(userGuid: string, revokedBefore: Date): Promise<void> {
    const expiresAt = new Date(Date.now() + 25 * 3600 * 1000);

    await this.prisma.lms_token_revocations.create({
      data: {
        usuario_guid: userGuid,
        revoked_at: revokedBefore,
        expires_at: expiresAt,
      },
    });

    this.cache.set(userGuid, Math.floor(revokedBefore.getTime() / 1000));

    this.logger.log(`Revoked tokens for user ${userGuid} issued before ${revokedBefore.toISOString()}`);
  }

  /**
   * Check if a token (identified by user GUID and issued-at timestamp) is revoked.
   * Returns true if the token was issued AT OR BEFORE the most recent revocation.
   * F3.5: Uses <= to ensure tokens from the same second as revocation are also invalidated.
   */
  isRevoked(userGuid: string, iat: number): boolean {
    const revokedAt = this.cache.get(userGuid);
    if (!revokedAt) return false;
    return iat <= revokedAt;
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }
}
