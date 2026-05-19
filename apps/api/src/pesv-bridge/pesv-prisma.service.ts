import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../../generated/pesv-client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

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
 * PesvPrismaService — Manages a READONLY Prisma Client connection
 * to the PESV database. Used exclusively by the bridge module to
 * read infraction data. NO write operations are permitted.
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
      this.logger.log('✅ Connected to PESV database (readonly)');
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
}
