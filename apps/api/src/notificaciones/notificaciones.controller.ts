import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { ChatService } from './chat.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { EnviarMensajeDto, SolicitarContactoDto, ResponderContactoDto } from './dto/mensajes.dto';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly notificacionesService: NotificacionesService,
    private readonly chatService: ChatService,
  ) {}

  // ─── NOTIFICACIONES ────────────────────────────────────

  @Get()
  async getNotificaciones(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    const guid = user.sub;
    return this.notificacionesService.getNotificaciones(guid, limit ? parseInt(limit, 10) : 30);
  }

  @Get('no-leidas')
  async contarNoLeidas(@CurrentUser() user: JwtPayload) {
    const guid = user.sub;
    return this.notificacionesService.contarNoLeidas(guid);
  }

  @Patch(':id/leer')
  async marcarLeida(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    // F3.10: Verify the notification belongs to the authenticated user
    return this.notificacionesService.marcarLeida(parseInt(id, 10), user.sub);
  }

  @Patch('leer-todas')
  async marcarTodasLeidas(@CurrentUser() user: JwtPayload) {
    const guid = user.sub;
    return this.notificacionesService.marcarTodasLeidas(guid);
  }

  @Delete('limpiar')
  async limpiarNotificaciones(@CurrentUser() user: JwtPayload) {
    const guid = user.sub;
    return this.notificacionesService.limpiarNotificaciones(guid);
  }

  // ─── MENSAJERÍA (delegated to ChatService) ────────────

  @Post('mensajes')
  async enviarMensaje(@CurrentUser() user: JwtPayload, @Body() body: EnviarMensajeDto) {
    return this.chatService.enviarMensaje({ remitente_guid: user.sub, ...body });
  }

  @Get('mensajes/:contacto_guid')
  async getConversacion(@CurrentUser() user: JwtPayload, @Param('contacto_guid') contacto_guid: string) {
    return this.chatService.getConversacion(user.sub, contacto_guid);
  }

  @Get('mensajes-contactos')
  async getContactos(@CurrentUser() user: JwtPayload) {
    return this.chatService.getContactos(user.sub);
  }

  @Patch('mensajes/:remitente_guid/leer')
  async marcarMensajesLeidos(@CurrentUser() user: JwtPayload, @Param('remitente_guid') remitente_guid: string) {
    return this.chatService.marcarMensajesLeidos(remitente_guid, user.sub);
  }

  @Delete('mensajes/:contacto_guid')
  async eliminarConversacion(@CurrentUser() user: JwtPayload, @Param('contacto_guid') contacto_guid: string) {
    return this.chatService.eliminarConversacion(user.sub, contacto_guid);
  }

  // ─── CONTACTOS DE CHAT (delegated to ChatService) ─────

  @Get('chat/buscar')
  async buscarContactosCurso(@CurrentUser() user: JwtPayload, @Query('q') search: string) {
    return this.chatService.buscarContactosCurso(user.sub, search || '');
  }

  @Post('chat/solicitar')
  async solicitarContacto(@CurrentUser() user: JwtPayload, @Body() body: SolicitarContactoDto) {
    return this.chatService.solicitarContacto(user.sub, body.receptor_guid, body.curso_guid);
  }

  @Patch('chat/responder/:id')
  async responderContacto(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: ResponderContactoDto) {
    return this.chatService.responderContacto(user.sub, parseInt(id, 10), body.aceptar);
  }

  @Get('chat/solicitudes')
  async getSolicitudesPendientes(@CurrentUser() user: JwtPayload) {
    return this.chatService.getSolicitudesPendientes(user.sub);
  }

  @Get('chat/contactos')
  async getContactosAprobados(@CurrentUser() user: JwtPayload) {
    return this.chatService.getContactosAprobados(user.sub);
  }
}
