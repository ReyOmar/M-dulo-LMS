import { Controller, Get, Patch, Post, Param, Body, Query } from '@nestjs/common';
import { EstudiantesService } from './estudiantes.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MarcarRecursoDto } from './dto/marcar-recurso.dto';

@Controller('cursos')
export class EstudiantesController {
  constructor(private readonly estudiantesService: EstudiantesService) {}

  @Get('/student/progreso')
  async getProgresoEstudiante(@CurrentUser() user: any, @Query('curso_guid') curso_guid: string) {
    return this.estudiantesService.getProgresoEstudiante(user.guid, curso_guid);
  }

  @Post('/student/completar-recurso')
  async marcarRecursoCompletado(@CurrentUser() user: any, @Body() body: MarcarRecursoDto) {
    return this.estudiantesService.marcarRecursoCompletado(user.guid, body.recurso_guid);
  }

  @Get('/student/dias-activos')
  async getDiasActivos(@CurrentUser() user: any, @Query('year') year: string, @Query('month') month: string) {
    return this.estudiantesService.getDiasActivos(user.guid, parseInt(year, 10), parseInt(month, 10));
  }

  @Get('/student/notificaciones')
  async getNotificacionesEstudiante(@CurrentUser() user: any) {
    return this.estudiantesService.getNotificacionesEstudiante(user.guid);
  }

  @Patch('/student/notificaciones/:id/leer')
  async marcarNotificacionLeida(@Param('id') id: string) {
    return this.estudiantesService.marcarNotificacionLeida(parseInt(id, 10));
  }

  @Get('/student/metricas')
  async getMetricasEstudiante(@CurrentUser() user: any) {
    return this.estudiantesService.getMetricasEstudiante(user.guid);
  }
}
