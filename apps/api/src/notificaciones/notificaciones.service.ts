import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LmsGateway } from '../ws/lms.gateway';
import { lms_tipo_notificacion } from '@prisma/client';

@Injectable()
export class NotificacionesService {
  constructor(
    private prisma: PrismaService,
    private lmsGateway: LmsGateway,
  ) {}

  /**
   * Create an in-app notification and broadcast it via WebSocket in real-time.
   */
  async crearNotificacion(data: {
    usuario_guid: string;
    tipo: lms_tipo_notificacion;
    titulo: string;
    mensaje: string;
    url_accion?: string;
    ref_tipo?: string;
    ref_guid?: string;
  }) {
    const notif = await this.prisma.lms_notificaciones.create({ data });

    // Broadcast to the specific user in real-time
    this.lmsGateway.broadcast('notification:new', {
      id: notif.id,
      tipo: notif.tipo,
      titulo: notif.titulo,
      mensaje: notif.mensaje,
      url_accion: notif.url_accion,
      leida: false,
      created_at: notif.created_at,
    }, [data.usuario_guid]);

    return notif;
  }

  /**
   * Get all notifications for a user, ordered by newest first.
   */
  async getNotificaciones(usuario_guid: string, limit = 30) {
    return this.prisma.lms_notificaciones.findMany({
      where: { usuario_guid },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Count unread notifications for a user.
   */
  async contarNoLeidas(usuario_guid: string) {
    const count = await this.prisma.lms_notificaciones.count({
      where: { usuario_guid, leida: false },
    });
    return { count };
  }

  /**
   * Mark a single notification as read.
   */
  async marcarLeida(id: number) {
    return this.prisma.lms_notificaciones.update({
      where: { id },
      data: { leida: true },
    });
  }

  /**
   * Mark all notifications as read for a user.
   */
  async marcarTodasLeidas(usuario_guid: string) {
    await this.prisma.lms_notificaciones.updateMany({
      where: { usuario_guid, leida: false },
      data: { leida: true },
    });
    return { message: 'Todas las notificaciones marcadas como leídas.' };
  }

  // ─── MENSAJERÍA ────────────────────────────────────────

  /**
   * Send a message between users and create a notification for the recipient.
   */
  async enviarMensaje(data: {
    remitente_guid: string;
    destinatario_guid: string;
    asunto: string;
    contenido: string;
    ref_tipo?: string;
    ref_guid?: string;
  }) {
    const mensaje = await this.prisma.lms_mensajes.create({ data });

    // Look up sender name for the notification
    const remitente = await this.prisma.usuarios.findUnique({
      where: { guid: data.remitente_guid },
      select: { nombre: true, apellido: true },
    });
    const nombreRemitente = remitente ? `${remitente.nombre} ${remitente.apellido}` : 'Usuario';

    // Create in-app notification for the recipient
    await this.crearNotificacion({
      usuario_guid: data.destinatario_guid,
      tipo: 'MENSAJE_NUEVO',
      titulo: `Mensaje de ${nombreRemitente}`,
      mensaje: data.asunto,
      url_accion: '/dashboard/mensajes',
      ref_tipo: 'mensaje',
      ref_guid: mensaje.id.toString(),
    });

    // Also broadcast the message event directly
    this.lmsGateway.broadcast('message:new', {
      id: mensaje.id,
      remitente_guid: data.remitente_guid,
      remitente_nombre: nombreRemitente,
      asunto: data.asunto,
      contenido: data.contenido,
      ref_tipo: data.ref_tipo,
      ref_guid: data.ref_guid,
      created_at: mensaje.created_at,
    }, [data.destinatario_guid]);

    return mensaje;
  }

  /**
   * Get conversation history between two users.
   */
  async getConversacion(usuario1_guid: string, usuario2_guid: string) {
    return this.prisma.lms_mensajes.findMany({
      where: {
        OR: [
          { remitente_guid: usuario1_guid, destinatario_guid: usuario2_guid },
          { remitente_guid: usuario2_guid, destinatario_guid: usuario1_guid },
        ],
      },
      orderBy: { created_at: 'asc' },
      include: {
        remitente: { select: { guid: true, nombre: true, apellido: true, rol: true } },
      },
    });
  }

  /**
   * Get list of conversations (unique contacts) for a user.
   */
  async getContactos(usuario_guid: string) {
    // Get all messages involving this user
    const mensajes = await this.prisma.lms_mensajes.findMany({
      where: {
        OR: [
          { remitente_guid: usuario_guid },
          { destinatario_guid: usuario_guid },
        ],
      },
      orderBy: { created_at: 'desc' },
      include: {
        remitente: { select: { guid: true, nombre: true, apellido: true, rol: true } },
        destinatario: { select: { guid: true, nombre: true, apellido: true, rol: true } },
      },
    });

    // Extract unique contact GUIDs
    const contactGuids = new Set<string>();
    const contactMap = new Map<string, any>();
    for (const m of mensajes) {
      const otherUser = m.remitente_guid === usuario_guid ? m.destinatario : m.remitente;
      if (!contactMap.has(otherUser.guid)) {
        contactGuids.add(otherUser.guid);
        contactMap.set(otherUser.guid, {
          ...otherUser,
          ultimo_mensaje: m.contenido,
          ultimo_mensaje_fecha: m.created_at,
          no_leidos: 0,
        });
      }
    }

    // Batch fetch all unread counts in a single query
    if (contactGuids.size > 0) {
      const unreadCounts = await this.prisma.lms_mensajes.groupBy({
        by: ['remitente_guid'],
        where: {
          remitente_guid: { in: Array.from(contactGuids) },
          destinatario_guid: usuario_guid,
          leido: false,
        },
        _count: { id: true },
      });
      for (const uc of unreadCounts) {
        const contact = contactMap.get(uc.remitente_guid);
        if (contact) contact.no_leidos = uc._count.id;
      }
    }

    return Array.from(contactMap.values());
  }

  /**
   * Mark all messages from a sender as read.
   */
  async marcarMensajesLeidos(remitente_guid: string, destinatario_guid: string) {
    await this.prisma.lms_mensajes.updateMany({
      where: { remitente_guid, destinatario_guid, leido: false },
      data: { leido: true },
    });
    return { message: 'Mensajes marcados como leídos.' };
  }
}
