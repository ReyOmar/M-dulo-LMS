import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  /**
   * Get notifications for the current user.
   */
  @Get()
  async getNotificaciones(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    const guid = user.sub;
    return this.notificacionesService.getNotificaciones(guid, limit ? parseInt(limit, 10) : 30);
  }

  /**
   * Count unread notifications for the current user.
   */
  @Get('no-leidas')
  async contarNoLeidas(@CurrentUser() user: JwtPayload) {
    const guid = user.sub;
    return this.notificacionesService.contarNoLeidas(guid);
  }

  /**
   * Mark a notification as read.
   */
  @Patch(':id/leer')
  async marcarLeida(@Param('id') id: string) {
    return this.notificacionesService.marcarLeida(parseInt(id, 10));
  }

  /**
   * Mark all notifications as read.
   */
  @Patch('leer-todas')
  async marcarTodasLeidas(@CurrentUser() user: JwtPayload) {
    const guid = user.sub;
    return this.notificacionesService.marcarTodasLeidas(guid);
  }

  /**
   * Delete all notifications for the current user.
   */
  @Delete('limpiar')
  async limpiarNotificaciones(@CurrentUser() user: JwtPayload) {
    const guid = user.sub;
    return this.notificacionesService.limpiarNotificaciones(guid);
  }

  // ─── MENSAJERÍA ────────────────────────────────────────

  /**
   * Send a message to another user.
   */
  @Post('mensajes')
  async enviarMensaje(@CurrentUser() user: JwtPayload, @Body() body: { destinatario_guid: string; asunto: string; contenido: string; ref_tipo?: string; ref_guid?: string }) {
    const guid = user.sub;
    return this.notificacionesService.enviarMensaje({
      remitente_guid: guid,
      ...body,
    });
  }

  /**
   * Get conversation with a specific user.
   */
  @Get('mensajes/:contacto_guid')
  async getConversacion(@CurrentUser() user: JwtPayload, @Param('contacto_guid') contacto_guid: string) {
    const guid = user.sub;
    return this.notificacionesService.getConversacion(guid, contacto_guid);
  }

  /**
   * Get list of message contacts.
   */
  @Get('mensajes-contactos')
  async getContactos(@CurrentUser() user: JwtPayload) {
    const guid = user.sub;
    return this.notificacionesService.getContactos(guid);
  }

  /**
   * Mark messages from a user as read.
   */
  @Patch('mensajes/:remitente_guid/leer')
  async marcarMensajesLeidos(@CurrentUser() user: JwtPayload, @Param('remitente_guid') remitente_guid: string) {
    const guid = user.sub;
    return this.notificacionesService.marcarMensajesLeidos(remitente_guid, guid);
  }

  /**
   * Delete conversation with a specific user.
   */
  @Delete('mensajes/:contacto_guid')
  async eliminarConversacion(@CurrentUser() user: JwtPayload, @Param('contacto_guid') contacto_guid: string) {
    const guid = user.sub;
    return this.notificacionesService.eliminarConversacion(guid, contacto_guid);
  }

  // ─── CONTACTOS DE CHAT ────────────────────────────────

  /**
   * Search for users in the same courses to start a conversation.
   */
  @Get('chat/buscar')
  async buscarContactosCurso(@CurrentUser() user: JwtPayload, @Query('q') search: string) {
    const guid = user.sub;
    return this.notificacionesService.buscarContactosCurso(guid, search || '');
  }

  /**
   * Send a contact request.
   */
  @Post('chat/solicitar')
  async solicitarContacto(@CurrentUser() user: JwtPayload, @Body() body: { receptor_guid: string; curso_guid: string }) {
    const guid = user.sub;
    return this.notificacionesService.solicitarContacto(guid, body.receptor_guid, body.curso_guid);
  }

  /**
   * Accept or reject a contact request.
   */
  @Patch('chat/responder/:id')
  async responderContacto(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { aceptar: boolean }) {
    const guid = user.sub;
    return this.notificacionesService.responderContacto(guid, parseInt(id, 10), body.aceptar);
  }

  /**
   * Get pending contact requests.
   */
  @Get('chat/solicitudes')
  async getSolicitudesPendientes(@CurrentUser() user: JwtPayload) {
    const guid = user.sub;
    return this.notificacionesService.getSolicitudesPendientes(guid);
  }

  /**
   * Get approved contacts only (replaces old getContactos).
   */
  @Get('chat/contactos')
  async getContactosAprobados(@CurrentUser() user: JwtPayload) {
    const guid = user.sub;
    return this.notificacionesService.getContactosAprobados(guid);
  }
}
