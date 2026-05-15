import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  /**
   * Health check endpoint for monitoring and load balancers.
   *
   * SEC: Only exposes minimal operational data. Does NOT expose:
   * - Memory usage (information disclosure)
   * - Environment name (NODE_ENV)
   * - Storage backend type
   * - Application version
   * - Uptime details
   *
   * These are available via internal monitoring tools, not public endpoints.
   */
  @Public()
  @Get()
  async check() {
    let dbStatus = 'ok';
    let dbLatencyMs: number | null = null;
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
    };
  }
}
