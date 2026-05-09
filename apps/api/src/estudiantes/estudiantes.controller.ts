import { Controller, Get, Patch, Post, Param, Body, Query } from '@nestjs/common';
import { EstudiantesService } from './estudiantes.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Public } from '../common/decorators/public.decorator';
import { MarcarRecursoDto } from './dto/marcar-recurso.dto';

@Controller('estudiantes')
export class EstudiantesController {
  constructor(private readonly estudiantesService: EstudiantesService) {}

  @Get('/student/progreso')
  async getProgresoEstudiante(@CurrentUser() user: JwtPayload, @Query('curso_guid') curso_guid: string, @Query('usuario_guid') usuario_guid?: string) {
    const guid = usuario_guid || user.sub;
    return this.estudiantesService.getProgresoEstudiante(guid, curso_guid);
  }

  @Post('/student/completar-recurso')
  async marcarRecursoCompletado(@CurrentUser() user: JwtPayload, @Body() body: MarcarRecursoDto, @Query('usuario_guid') usuario_guid?: string) {
    const guid = usuario_guid || user.sub;
    return this.estudiantesService.marcarRecursoCompletado(guid, body.recurso_guid);
  }

  @Get('/student/dias-activos')
  async getDiasActivos(@CurrentUser() user: JwtPayload, @Query('year') year: string, @Query('month') month: string, @Query('usuario_guid') usuario_guid?: string) {
    const guid = usuario_guid || user.sub;
    return this.estudiantesService.getDiasActivos(guid, parseInt(year, 10), parseInt(month, 10));
  }

  @Get('/student/notificaciones')
  async getNotificacionesEstudiante(@CurrentUser() user: JwtPayload, @Query('usuario_guid') usuario_guid?: string) {
    const guid = usuario_guid || user.sub;
    return this.estudiantesService.getNotificacionesEstudiante(guid);
  }

  @Patch('/student/notificaciones/:id/leer')
  async marcarNotificacionLeida(@Param('id') id: string) {
    return this.estudiantesService.marcarNotificacionLeida(parseInt(id, 10));
  }

  @Get('/student/metricas')
  async getMetricasEstudiante(@CurrentUser() user: JwtPayload, @Query('usuario_guid') usuario_guid?: string) {
    const guid = usuario_guid || user.sub;
    return this.estudiantesService.getMetricasEstudiante(guid);
  }

  @Post('/student/heartbeat')
  async registrarHeartbeat(
    @CurrentUser() user: JwtPayload,
    @Body() body: { curso_guid: string },
    @Query('usuario_guid') usuario_guid?: string,
  ) {
    const guid = usuario_guid || user.sub;
    return this.estudiantesService.registrarHeartbeat(guid, body.curso_guid);
  }
}

