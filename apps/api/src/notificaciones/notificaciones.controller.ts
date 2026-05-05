import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  /**
   * Get notifications for the current user.
   */
  @Get()
  async getNotificaciones(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const guid = user?.sub || user?.guid;
    return this.notificacionesService.getNotificaciones(guid, limit ? parseInt(limit, 10) : 30);
  }

  /**
   * Count unread notifications for the current user.
   */
  @Get('no-leidas')
  async contarNoLeidas(@CurrentUser() user: any) {
    const guid = user?.sub || user?.guid;
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
  async marcarTodasLeidas(@CurrentUser() user: any) {
    const guid = user?.sub || user?.guid;
    return this.notificacionesService.marcarTodasLeidas(guid);
  }

  // ─── MENSAJERÍA ────────────────────────────────────────

  /**
   * Send a message to another user.
   */
  @Post('mensajes')
  async enviarMensaje(@CurrentUser() user: any, @Body() body: { destinatario_guid: string; asunto: string; contenido: string; ref_tipo?: string; ref_guid?: string }) {
    const guid = user?.sub || user?.guid;
    return this.notificacionesService.enviarMensaje({
      remitente_guid: guid,
      ...body,
    });
  }

  /**
   * Get conversation with a specific user.
   */
  @Get('mensajes/:contacto_guid')
  async getConversacion(@CurrentUser() user: any, @Param('contacto_guid') contacto_guid: string) {
    const guid = user?.sub || user?.guid;
    return this.notificacionesService.getConversacion(guid, contacto_guid);
  }

  /**
   * Get list of message contacts.
   */
  @Get('mensajes-contactos')
  async getContactos(@CurrentUser() user: any) {
    const guid = user?.sub || user?.guid;
    return this.notificacionesService.getContactos(guid);
  }

  /**
   * Mark messages from a user as read.
   */
  @Patch('mensajes/:remitente_guid/leer')
  async marcarMensajesLeidos(@CurrentUser() user: any, @Param('remitente_guid') remitente_guid: string) {
    const guid = user?.sub || user?.guid;
    return this.notificacionesService.marcarMensajesLeidos(remitente_guid, guid);
  }
}
