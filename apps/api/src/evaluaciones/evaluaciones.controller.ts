import { Controller, Get, Post, Patch, Param, Body, Query, UnauthorizedException, BadRequestException, Req } from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CalificarEntregaDto } from './dto/calificar-entrega.dto';

@Controller('cursos')
export class EvaluacionesController {
  constructor(private readonly evaluacionesService: EvaluacionesService) {}

  /**
   * Submit a file for a task via multipart/form-data.
   * Expects a 'file' field with the uploaded file.
   */
  @Post('/tareas/:tarea_guid/entregas')
  async submitEntrega(
    @CurrentUser() user: JwtPayload,
    @Param('tarea_guid') tarea_guid: string,
    @Req() req: any,
  ) {
    const userGuid = user.sub;
    if (!userGuid) throw new UnauthorizedException('Debes iniciar sesión para subir tu tarea.');

    const data = await req.file();
    if (!data) {
      throw new BadRequestException('No se envió ningún archivo.');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      throw new BadRequestException('El archivo está vacío.');
    }

    return this.evaluacionesService.submitEntrega(tarea_guid, {
      buffer,
      nombre_archivo: data.filename || 'archivo.bin',
      usuario_guid: userGuid,
    });
  }

  @Get('/tareas/:tarea_guid/entregas/mine')
  async getEntrega(@CurrentUser() user: JwtPayload, @Param('tarea_guid') tarea_guid: string) {
    const userGuid = user.sub;
    if (!userGuid) throw new UnauthorizedException('Usuario no autenticado correctamente.');
    const entrega = await this.evaluacionesService.getEntrega(tarea_guid, userGuid);
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
