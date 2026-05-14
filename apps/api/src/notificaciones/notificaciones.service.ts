import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LmsGateway } from '../ws/lms.gateway';
import { lms_tipo_notificacion } from '@prisma/client';

/**
 * NotificacionesService — In-app notification management only.
 * Chat/messaging logic has been extracted to ChatService.
 */
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
   * F3.10: Enforces ownership — only the notification's owner can mark it read.
   */
  async marcarLeida(id: number, usuario_guid: string) {
    return this.prisma.lms_notificaciones.updateMany({
      where: { id, usuario_guid },
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

  /**
   * Delete all notifications for a user.
   */
  async limpiarNotificaciones(usuario_guid: string) {
    await this.prisma.lms_notificaciones.deleteMany({
      where: { usuario_guid },
    });
    return { message: 'Notificaciones eliminadas.' };
  }
}
