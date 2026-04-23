import { Controller, Get, Post, Body, Param, Query, Patch, Delete } from '@nestjs/common';
import { CursosService } from './cursos.service';
import { lms_tipo_recurso } from '@prisma/client';

@Controller('cursos')
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @Get()
  async getCursos(
    @Query('role') role?: string, 
    @Query('profesor_guid') profesor_guid?: string,
    @Query('usuario_guid') usuario_guid?: string
  ) {
    if (role === 'admin') {
        return this.cursosService.getAllCursosParaAdmin();
    }
    if (role === 'teacher' && profesor_guid) {
        return this.cursosService.getCursosDeProfesor(profesor_guid);
    }
    if (role === 'student' && usuario_guid) {
        return this.cursosService.getCursosDeEstudiante(usuario_guid);
    }
    return this.cursosService.getCursosActivosParaEstudiante();
  }

  @Post('/modulos/:moduloId/bloques')
  async addBloque(
    @Param('moduloId') modulo_guid: string, 
    @Body() body: { tipo: lms_tipo_recurso; contenido_html?: string; titulo?: string }
  ) {
    return this.cursosService.addBloqueToModulo(modulo_guid, body);
  }

  @Patch('/modulos/:moduloId')
  async editModulo(@Param('moduloId') modulo_guid: string, @Body() body: { titulo: string }) {
    return this.cursosService.updateModulo(modulo_guid, body);
  }

  @Patch('/bloques/:id')
  async editBloque(@Param('id') id: string, @Body() body: { titulo?: string; contenido_html?: string; url_archivo?: string }) {
      return this.cursosService.updateBloque(id, body);
  }

  @Delete('/bloques/:id')
  async removeBloque(@Param('id') id: string) {
      return this.cursosService.deleteBloque(id);
  }

  @Get(':id')
  async getCursoDetalle(@Param('id') id: string) {
    return this.cursosService.getCursoDetalleCompleto(id);
  }

  @Post()
  async createCurso(@Body() body: { titulo: string; profesor_guid: string }) {
    return this.cursosService.createCurso(body);
  }

  @Patch(':id')
  async editCurso(@Param('id') curso_guid: string, @Body() body: { titulo: string; estado: string }) {
    return this.cursosService.updateCurso(curso_guid, body);
  }

  @Post(':id/modulos')
  async createModulo(@Param('id') curso_guid: string, @Body() body: { titulo: string }) {
    return this.cursosService.createModuloParaCurso(curso_guid, body);
  }

  @Post('/tareas/:tareaId/entregas')
  async entregarTarea(
    @Param('tareaId') tareaId: string, 
    @Body() body: { base64: string, nombre_archivo: string, usuario_guid: string }
  ) {
    return this.cursosService.submitEntrega(tareaId, body);
  }

  @Get('/tareas/:tareaId/entregas')
  async getEntrega(
    @Param('tareaId') tareaId: string,
    @Query('usuario_guid') usuario_guid: string
  ) {
    return this.cursosService.getEntrega(tareaId, usuario_guid);
  }

  @Get('/tareas/:tareaId/todas-entregas')
  async getTodasEntregas(@Param('tareaId') tareaId: string) {
    return this.cursosService.getTodasEntregasParaTarea(tareaId);
  }

  @Get('/profesores')
  async getProfesores() {
    return this.cursosService.getProfesores();
  }

  @Post(':id/asignar')
  async asignarCurso(@Param('id') curso_guid: string, @Body() body: { profesor_guid: string }) {
    return this.cursosService.asignarCurso(curso_guid, body.profesor_guid);
  }
}
