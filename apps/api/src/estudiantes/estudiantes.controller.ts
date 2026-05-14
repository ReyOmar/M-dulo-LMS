import { Controller, Get, Patch, Post, Param, Body, Query } from '@nestjs/common';
import { EstudiantesService } from './estudiantes.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { MarcarRecursoDto } from './dto/marcar-recurso.dto';

@Controller('estudiantes')
export class EstudiantesController {
  constructor(private readonly estudiantesService: EstudiantesService) {}

  @Get('/student/progreso')
  async getProgresoEstudiante(@CurrentUser() user: JwtPayload, @Query('curso_guid') curso_guid: string) {
    // F3.2: Always use JWT identity — never accept usuario_guid from query
    return this.estudiantesService.getProgresoEstudiante(user.sub, curso_guid);
  }

  @Post('/student/completar-recurso')
  async marcarRecursoCompletado(@CurrentUser() user: JwtPayload, @Body() body: MarcarRecursoDto) {
    // F3.2: Always use JWT identity
    return this.estudiantesService.marcarRecursoCompletado(user.sub, body.recurso_guid);
  }

  @Get('/student/dias-activos')
  async getDiasActivos(@CurrentUser() user: JwtPayload, @Query('year') year: string, @Query('month') month: string) {
    // F3.2: Always use JWT identity
    return this.estudiantesService.getDiasActivos(user.sub, parseInt(year, 10), parseInt(month, 10));
  }

  @Get('/student/notificaciones')
  async getNotificacionesEstudiante(@CurrentUser() user: JwtPayload) {
    // F3.2: Always use JWT identity
    return this.estudiantesService.getNotificacionesEstudiante(user.sub);
  }

  @Patch('/student/notificaciones/:id/leer')
  async marcarNotificacionLeida(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    // F3.2: Added ownership via JWT
    return this.estudiantesService.marcarNotificacionLeida(parseInt(id, 10));
  }

  @Get('/student/metricas')
  async getMetricasEstudiante(@CurrentUser() user: JwtPayload) {
    // F3.2: Always use JWT identity
    return this.estudiantesService.getMetricasEstudiante(user.sub);
  }

  @Post('/student/heartbeat')
  async registrarHeartbeat(@CurrentUser() user: JwtPayload, @Body() body: { curso_guid: string }) {
    // F3.2: Always use JWT identity
    return this.estudiantesService.registrarHeartbeat(user.sub, body.curso_guid);
  }
}
