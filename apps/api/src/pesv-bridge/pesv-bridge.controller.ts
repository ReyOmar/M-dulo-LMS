import { Controller, Get, Post, Query, Logger } from '@nestjs/common';
import { PesvBridgeService } from './pesv-bridge.service';
import { Roles } from '../common/decorators/roles.decorator';
import { lms_pesv_bridge_estado } from '@prisma/client';

/**
 * PesvBridgeController — Admin-only REST endpoints for managing
 * the PESV ↔ LMS infraction bridge.
 *
 * All endpoints require ADMINISTRADOR role.
 */
@Controller('pesv-bridge')
export class PesvBridgeController {
  private readonly logger = new Logger(PesvBridgeController.name);

  constructor(private readonly bridgeService: PesvBridgeService) {}

  /**
   * GET /api/pesv-bridge/registros — Bridge history with filters
   */
  @Get('registros')
  @Roles('ADMINISTRADOR')
  async getRegistros(
    @Query('estado') estado?: lms_pesv_bridge_estado,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bridgeService.getRegistros({
      estado,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /api/pesv-bridge/pendientes — Records with missing courses
   */
  @Get('pendientes')
  @Roles('ADMINISTRADOR')
  async getPendientes() {
    return this.bridgeService.getPendientes();
  }

  /**
   * GET /api/pesv-bridge/stats — Summary statistics
   */
  @Get('stats')
  @Roles('ADMINISTRADOR')
  async getStats() {
    return this.bridgeService.getStats();
  }

  /**
   * POST /api/pesv-bridge/sync — Force manual sync
   */
  @Post('sync')
  @Roles('ADMINISTRADOR')
  async forceSync() {
    this.logger.log('🔧 Manual sync triggered by admin');
    const result = await this.bridgeService.syncInfracciones();
    return {
      message: 'Sincronización completada.',
      ...result,
    };
  }

  /**
   * POST /api/pesv-bridge/retry — Retry pending enrollments (CURSO_NO_ENCONTRADO)
   */
  @Post('retry')
  @Roles('ADMINISTRADOR')
  async retryPending() {
    this.logger.log('🔧 Manual retry triggered by admin');
    await this.bridgeService.retryPendingEnrollments();
    const stats = await this.bridgeService.getStats();
    return {
      message: 'Reintento de matrículas pendientes completado.',
      ...stats,
    };
  }
}
