import { Controller, Get, Query } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Get('/examiner/monitoreo')
  async getMonitoreoEstudiantes(@CurrentUser() user: JwtPayload) {
    // F3.7: Derive professor GUID from JWT — never accept from query params
    return this.dashboardsService.getMonitoreoEstudiantes(user.sub);
  }

  @Roles('ADMINISTRADOR')
  @Get('/admin/dashboard-stats')
  async getAdminDashboardStats() {
    return this.dashboardsService.getAdminDashboardStats();
  }
}
