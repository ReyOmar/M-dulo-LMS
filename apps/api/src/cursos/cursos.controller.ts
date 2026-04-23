import { Controller, Get, Post, Body, Param, Query, Patch, Delete, Res } from '@nestjs/common';
import { CursosService } from './cursos.service';
import { lms_tipo_recurso } from '@prisma/client';
import * as fs from 'fs';

@Controller('cursos')
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  // =============================================
  // STATIC / SPECIFIC routes MUST come BEFORE :id
  // =============================================

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

  @Get('/profesores')
  async getProfesores() {
    return this.cursosService.getProfesores();
  }

  // --- /examiner routes ---
  @Get('/examiner/monitoreo')
  async getMonitoreo(@Query('profesor_guid') profesor_guid: string) {
    return this.cursosService.getMonitoreoEstudiantes(profesor_guid);
  }

  @Get('/examiner/entregas')
  async getEntregasParaCalificar(@Query('profesor_guid') profesor_guid: string) {
    return this.cursosService.getEntregasParaCalificar(profesor_guid);
  }

  @Patch('/entregas/:guid/calificar')
  async calificarEntrega(@Param('guid') guid: string, @Body() body: { calificacion: number; comentario?: string }) {
    return this.cursosService.calificarEntrega(guid, body);
  }

  // --- /upload & /download routes ---
  @Post('/upload')
  async uploadFile(@Body() body: { base64: string; nombre: string }) {
    const filename = this.cursosService.uploadFile(body.base64, body.nombre);
    return { filename };
  }

  @Get('/download/:filename')
  async downloadFile(@Param('filename') filename: string, @Res() res: any) {
    const filePath = this.cursosService.getUploadPath(filename);
    const buffer = fs.readFileSync(filePath);
    
    // Determine content type from extension
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    
    const contentType = mimeTypes[ext || ''] || 'application/octet-stream';
    
    res.header('Content-Type', contentType);
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.header('Content-Length', buffer.length);
    return res.send(buffer);
  }

  // --- /bloques routes ---
  @Get('/bloques/:id')
  async getBloque(@Param('id') id: string) {
      return this.cursosService.getBloque(id);
  }

  @Patch('/bloques/:id')
  async editBloque(@Param('id') id: string, @Body() body: { titulo?: string; contenido_html?: string; url_archivo?: string; url_referencia?: string; archivo_adjunto?: string; archivo_adjunto_nombre?: string; quiz_config?: string; archivo_max_size_mb?: number }) {
      return this.cursosService.updateBloque(id, body);
  }

  @Delete('/bloques/:id')
  async removeBloque(@Param('id') id: string) {
      return this.cursosService.deleteBloque(id);
  }

  // --- /modulos routes ---
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

  @Delete('/modulos/:moduloId')
  async removeModulo(@Param('moduloId') id: string) {
    return this.cursosService.deleteModulo(id);
  }

  // --- /tareas routes ---
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

  // =============================================
  // DYNAMIC :id routes MUST come LAST
  // =============================================

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

  @Delete(':id')
  async removeCurso(@Param('id') id: string) {
    return this.cursosService.deleteCurso(id);
  }

  @Post(':id/modulos')
  async createModulo(@Param('id') curso_guid: string, @Body() body: { titulo: string }) {
    return this.cursosService.createModuloParaCurso(curso_guid, body);
  }

  @Post(':id/asignar')
  async asignarCurso(@Param('id') curso_guid: string, @Body() body: { profesor_guid: string }) {
    return this.cursosService.asignarCurso(curso_guid, body.profesor_guid);
  }
}
