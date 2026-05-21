import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../../generated/pesv-client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// PESV estado_id constants (from terminos table)
const PESV_ESTADO_SUBSANADA = 202;

// Parse DATABASE_URL: mysql://user:password@host:port/database
function parseDbUrl(url: string) {
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) throw new Error('Invalid PESV_DATABASE_URL format. Expected: mysql://user:password@host:port/database');
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}

/**
 * PesvPrismaService — Manages a Prisma Client connection to the PESV database.
 *
 * Used exclusively by the bridge module to:
 * - READ infraction data (sync new infractions to LMS)
 * - WRITE-BACK subsanation status (update estado_id to SUBSANADA when course is completed)
 *
 * Security constraints:
 * - Only `subsanarInfraccion()` performs writes — limited to updating estado_id
 * - No DELETE, no INSERT, no other field updates
 * - Connection credentials come from PESV_DATABASE_URL env var (never hardcoded)
 */
@Injectable()
export class PesvPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PesvPrismaService.name);
  private readonly hasUrl: boolean;

  constructor() {
    const url = process.env.PESV_DATABASE_URL;
    if (!url) {
      // Don't throw — the module might be disabled. Use a dummy adapter.
      const dummyAdapter = new PrismaMariaDb({
        host: 'localhost',
        port: 3306,
        user: 'placeholder',
        password: 'placeholder',
        database: 'placeholder',
      });
      super({ adapter: dummyAdapter });
      Logger.warn(
        '⚠️ PESV_DATABASE_URL not configured. Bridge will not connect to PESV database.',
        'PesvPrismaService',
      );
    } else {
      const config = parseDbUrl(url);
      const adapter = new PrismaMariaDb({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectionLimit: 5,
        allowPublicKeyRetrieval: true,
      });
      super({ adapter });
    }
    this.hasUrl = !!url;
  }

  async onModuleInit() {
    if (!this.hasUrl) {
      this.logger.warn('PESV database connection skipped — PESV_DATABASE_URL not set.');
      return;
    }

    try {
      await this.$connect();
      this.logger.log('✅ Connected to PESV database');
    } catch (error) {
      this.logger.error('❌ Failed to connect to PESV database. Bridge sync will be disabled.', error);
    }
  }

  async onModuleDestroy() {
    if (this.hasUrl) {
      await this.$disconnect();
    }
  }

  /**
   * Check if the PESV database connection is available.
   */
  async isConnected(): Promise<boolean> {
    if (!this.hasUrl) return false;
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write-back: Update infracción estado to SUBSANADA in the PESV database.
   *
   * Called when a student completes the corresponding LMS course and receives
   * a certificate. This is the ONLY write operation permitted against PESV.
   *
   * @param guid - The infracción GUID in the PESV database
   * @returns true if update succeeded, false if it failed
   */
  async subsanarInfraccion(guid: string): Promise<boolean> {
    if (!this.hasUrl) {
      this.logger.warn('Cannot update PESV — database not connected.');
      return false;
    }

    try {
      const result = await this.infracciones.update({
        where: { guid },
        data: {
          estado_id: PESV_ESTADO_SUBSANADA,
          observaciones: `Subsanada via LMS - ${new Date().toISOString().split('T')[0]}`,
        },
      });

      if (result) {
        this.logger.log(`  ✅ PESV infracción ${guid} → SUBSANADA`);
        return true;
      }

      return false;
    } catch (err) {
      this.logger.error(`  ❌ Failed to update PESV infracción ${guid}:`, err);
      return false;
    }
  }
}
