import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubmitEntregaDto } from './dto/submit-entrega.dto';
import { CalificarEntregaDto } from './dto/calificar-entrega.dto';

@Controller('cursos')
export class EvaluacionesController {
  constructor(private readonly evaluacionesService: EvaluacionesService) {}

  @Post('/tareas/:tarea_guid/entregas')
  async submitEntrega(
    @CurrentUser() user: any,
    @Param('tarea_guid') tarea_guid: string,
    @Body() body: SubmitEntregaDto
  ) {
    return this.evaluacionesService.submitEntrega(tarea_guid, { ...body, usuario_guid: user.guid });
  }

  @Get('/tareas/:tarea_guid/entregas/mine')
  async getEntrega(@CurrentUser() user: any, @Param('tarea_guid') tarea_guid: string) {
    const entrega = await this.evaluacionesService.getEntrega(tarea_guid, user.guid);
    return entrega || { estado: 'PENDIENTE' };
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Get('/tareas/:tarea_guid/entregas')
  async getTodasEntregasParaTarea(@Param('tarea_guid') tarea_guid: string) {
    return this.evaluacionesService.getTodasEntregasParaTarea(tarea_guid);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Get('/examiner/entregas')
  async getEntregasParaCalificar(@Query('profesor_guid') profesor_guid: string) {
    return this.evaluacionesService.getEntregasParaCalificar(profesor_guid);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Patch('/entregas/:guid/calificar')
  async calificarEntrega(@Param('guid') guid: string, @Body() body: CalificarEntregaDto) {
    return this.evaluacionesService.calificarEntrega(guid, body);
  }
}
