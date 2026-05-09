import { Controller, Get, Post, Param, Body, Res, Query } from '@nestjs/common';
import { CertificadosService } from './certificados.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Public } from '../common/decorators/public.decorator';
import { FastifyReply } from 'fastify';
import * as fs from 'fs';

@Controller('estudiantes/student/certificados')
export class CertificadosController {
  constructor(private readonly certificadosService: CertificadosService) {}

  /**
   * Generate a certificate for a completed course.
   * Idempotent: returns existing certificate if already generated.
   */
  @Post('/generar')
  async generarCertificado(
    @CurrentUser() user: JwtPayload,
    @Body() body: { curso_guid: string },
    @Query('usuario_guid') usuario_guid?: string,
  ) {
    const guid = usuario_guid || user.sub;
    return this.certificadosService.generarCertificado(guid, body.curso_guid);
  }

  /**
   * Verify course completion status for a student.
   * Must be defined BEFORE /:guid to avoid route conflict.
   */
  @Get('/verificar/:curso_guid')
  async verificarCurso(
    @Param('curso_guid') curso_guid: string,
    @CurrentUser() user: JwtPayload,
    @Query('usuario_guid') usuario_guid?: string,
  ) {
    const guid = usuario_guid || user.sub;
    return this.certificadosService.verificarCursoCompleto(guid, curso_guid);
  }

  /**
   * List all certificates for the authenticated student.
   */
  @Get()
  async getCertificados(
    @CurrentUser() user: JwtPayload,
    @Query('usuario_guid') usuario_guid?: string,
  ) {
    const guid = usuario_guid || user.sub;
    return this.certificadosService.getCertificadosEstudiante(guid);
  }

  /**
   * Download the PDF file for a certificate.
   */
  @Get('/:guid/pdf')
  async downloadPDF(@Param('guid') guid: string, @Res() reply: FastifyReply) {
    const cert = await this.certificadosService.getCertificado(guid);
    const filePath = this.certificadosService.getArchivoPDF(cert.archivo_pdf);

    const stream = fs.createReadStream(filePath);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="Certificado-${cert.curso.titulo.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '')}.pdf"`);
    return reply.send(stream);
  }

  /**
   * Public certificate verification by verification code.
   * No authentication required — for third-party validation.
   */
  @Public()
  @Get('/publico/verificar/:codigo')
  async verificarPublico(@Param('codigo') codigo: string) {
    return this.certificadosService.verificarPublico(codigo);
  }

  /**
   * Get details for a specific certificate.
   */
  @Get('/:guid')
  async getCertificado(@Param('guid') guid: string) {
    return this.certificadosService.getCertificado(guid);
  }
}
