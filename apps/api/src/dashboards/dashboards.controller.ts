import { Controller, Get, Query } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Public()
@Controller('cursos')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Get('/examiner/monitoreo')
  async getMonitoreoEstudiantes(@Query('profesor_guid') profesor_guid: string) {
    return this.dashboardsService.getMonitoreoEstudiantes(profesor_guid);
  }

  @Roles('ADMINISTRADOR')
  @Get('/admin/dashboard-stats')
  async getAdminDashboardStats() {
    return this.dashboardsService.getAdminDashboardStats();
  }
}
