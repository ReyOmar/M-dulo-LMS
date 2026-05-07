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

  /**
   * Delete all notifications for a user.
   */
  async limpiarNotificaciones(usuario_guid: string) {
    await this.prisma.lms_notificaciones.deleteMany({
      where: { usuario_guid },
    });
    return { message: 'Notificaciones eliminadas.' };
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

  /**
   * Delete conversation history between two users.
   */
  async eliminarConversacion(usuario1_guid: string, usuario2_guid: string) {
    await this.prisma.lms_mensajes.deleteMany({
      where: {
        OR: [
          { remitente_guid: usuario1_guid, destinatario_guid: usuario2_guid },
          { remitente_guid: usuario2_guid, destinatario_guid: usuario1_guid },
        ],
      },
    });
    return { message: 'Conversación eliminada.' };
  }

  // ─── CONTACTOS DE CHAT (Aprobación mutua) ────────────

  /**
   * Search for users in the same course(s) to start a conversation.
   * Only returns users enrolled in at least one shared course.
   */
  async buscarContactosCurso(usuario_guid: string, search: string) {
    // Get courses the user is enrolled in (as student) or teaches (as professor)
    const user = await this.prisma.usuarios.findUnique({
      where: { guid: usuario_guid },
      select: { rol: true },
    });
    if (!user) return [];

    let courseGuids: string[] = [];

    if (user.rol === 'ESTUDIANTE') {
      const matriculas = await this.prisma.lms_matriculas.findMany({
        where: { usuario_guid },
        select: { curso_guid: true },
      });
      courseGuids = matriculas.map(m => m.curso_guid);
    } else {
      // Professor or admin — get courses they teach
      const cursos = await this.prisma.lms_cursos.findMany({
        where: { profesor_guid: usuario_guid },
        select: { guid: true },
      });
      courseGuids = cursos.map(c => c.guid);
      // Also get courses they're enrolled in (admins might be enrolled)
      const matriculas = await this.prisma.lms_matriculas.findMany({
        where: { usuario_guid },
        select: { curso_guid: true },
      });
      courseGuids.push(...matriculas.map(m => m.curso_guid));
    }

    if (courseGuids.length === 0) return [];

    // Find users in those courses (both enrolled students and professors)
    const [enrolledStudents, courseProfs] = await Promise.all([
      this.prisma.lms_matriculas.findMany({
        where: {
          curso_guid: { in: courseGuids },
          usuario_guid: { not: usuario_guid },
        },
        select: {
          curso_guid: true,
          usuario: { select: { guid: true, nombre: true, apellido: true, email: true, rol: true } },
        },
      }),
      this.prisma.lms_cursos.findMany({
        where: {
          guid: { in: courseGuids },
          profesor_guid: { not: usuario_guid },
        },
        select: {
          guid: true,
          profesor_guid: true,
          profesor: { select: { guid: true, nombre: true, apellido: true, email: true, rol: true } },
        },
      }),
    ]);

    // Build unique user map with their shared courses
    const userMap = new Map<string, { guid: string; nombre: string; apellido: string; email: string; rol: string; cursos: string[] }>();
    for (const m of enrolledStudents) {
      const u = m.usuario;
      if (!userMap.has(u.guid)) {
        userMap.set(u.guid, { ...u, cursos: [m.curso_guid] });
      } else {
        userMap.get(u.guid)!.cursos.push(m.curso_guid);
      }
    }
    for (const c of courseProfs) {
      if (c.profesor_guid && c.profesor) {
        const u = c.profesor;
        if (!userMap.has(u.guid)) {
          userMap.set(u.guid, { ...u, cursos: [c.guid] });
        } else {
          userMap.get(u.guid)!.cursos.push(c.guid);
        }
      }
    }

    // Filter by search term
    const searchLower = search.toLowerCase();
    const results = Array.from(userMap.values()).filter(u =>
      `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(searchLower)
    );

    // Check existing contact requests to show status
    const existingContacts = await this.prisma.lms_contacto_chat.findMany({
      where: {
        OR: [
          { solicitante_guid: usuario_guid },
          { receptor_guid: usuario_guid },
        ],
      },
    });

    return results.map(u => {
      const contact = existingContacts.find(c =>
        (c.solicitante_guid === usuario_guid && c.receptor_guid === u.guid) ||
        (c.receptor_guid === usuario_guid && c.solicitante_guid === u.guid)
      );
      return {
        ...u,
        contacto_estado: contact?.estado || null,
        es_examinador: u.rol === 'PROFESOR',
      };
    });
  }

  /**
   * Send a contact request to another user in a shared course.
   */
  async solicitarContacto(solicitante_guid: string, receptor_guid: string, curso_guid: string) {
    // Check if the receptor is a professor of the course — auto-accept
    const curso = await this.prisma.lms_cursos.findUnique({
      where: { guid: curso_guid },
      select: { profesor_guid: true },
    });
    const isProfesor = curso?.profesor_guid === receptor_guid;

    const existing = await this.prisma.lms_contacto_chat.findFirst({
      where: {
        OR: [
          { solicitante_guid, receptor_guid, curso_guid },
          { solicitante_guid: receptor_guid, receptor_guid: solicitante_guid, curso_guid },
        ],
      },
    });

    if (existing) {
      // If rejected, allow re-request
      if (existing.estado === 'RECHAZADO') {
        return this.prisma.lms_contacto_chat.update({
          where: { id: existing.id },
          data: { estado: isProfesor ? 'ACEPTADO' : 'PENDIENTE', solicitante_guid, receptor_guid },
        });
      }
      return existing;
    }

    const contacto = await this.prisma.lms_contacto_chat.create({
      data: {
        solicitante_guid,
        receptor_guid,
        curso_guid,
        estado: isProfesor ? 'ACEPTADO' : 'PENDIENTE',
      },
    });

    if (!isProfesor) {
      // Notify the receptor about the request
      const solicitante = await this.prisma.usuarios.findUnique({
        where: { guid: solicitante_guid },
        select: { nombre: true, apellido: true },
      });
      await this.crearNotificacion({
        usuario_guid: receptor_guid,
        tipo: 'MENSAJE_NUEVO',
        titulo: 'Solicitud de conversación',
        mensaje: `${solicitante?.nombre} ${solicitante?.apellido} quiere iniciar una conversación contigo.`,
        url_accion: '/dashboard/mensajes',
      });
    }

    return contacto;
  }

  /**
   * Accept or reject a contact request.
   */
  async responderContacto(receptor_guid: string, contacto_id: number, aceptar: boolean) {
    const contacto = await this.prisma.lms_contacto_chat.findFirst({
      where: { id: contacto_id, receptor_guid },
    });
    if (!contacto) return null;

    const updated = await this.prisma.lms_contacto_chat.update({
      where: { id: contacto_id },
      data: { estado: aceptar ? 'ACEPTADO' : 'RECHAZADO' },
    });

    if (aceptar) {
      const receptor = await this.prisma.usuarios.findUnique({
        where: { guid: receptor_guid },
        select: { nombre: true, apellido: true },
      });
      await this.crearNotificacion({
        usuario_guid: contacto.solicitante_guid,
        tipo: 'MENSAJE_NUEVO',
        titulo: 'Solicitud aceptada',
        mensaje: `${receptor?.nombre} ${receptor?.apellido} ha aceptado tu solicitud. Ya pueden conversar.`,
        url_accion: '/dashboard/mensajes',
      });
    }

    return updated;
  }

  /**
   * Get pending contact requests for a user.
   */
  async getSolicitudesPendientes(usuario_guid: string) {
    const solicitudes = await this.prisma.lms_contacto_chat.findMany({
      where: { receptor_guid: usuario_guid, estado: 'PENDIENTE' },
      orderBy: { created_at: 'desc' },
    });

    // Fetch solicitante info
    const guids = solicitudes.map(s => s.solicitante_guid);
    const usuarios = guids.length > 0 ? await this.prisma.usuarios.findMany({
      where: { guid: { in: guids } },
      select: { guid: true, nombre: true, apellido: true, email: true, rol: true },
    }) : [];

    const userMap = new Map(usuarios.map(u => [u.guid, u]));

    return solicitudes.map(s => ({
      ...s,
      solicitante: userMap.get(s.solicitante_guid) || null,
    }));
  }

  /**
   * Override getContactos to only show approved contacts.
   */
  async getContactosAprobados(usuario_guid: string) {
    // Get approved contacts
    const contactos = await this.prisma.lms_contacto_chat.findMany({
      where: {
        estado: 'ACEPTADO',
        OR: [
          { solicitante_guid: usuario_guid },
          { receptor_guid: usuario_guid },
        ],
      },
    });

    // Get unique contact GUIDs
    const contactGuids = [...new Set(contactos.map(c =>
      c.solicitante_guid === usuario_guid ? c.receptor_guid : c.solicitante_guid
    ))];

    if (contactGuids.length === 0) return [];

    // Batch: Fetch user info, all relevant messages, and unread counts in parallel
    const [usuarios, allMessages, unreadCounts] = await Promise.all([
      this.prisma.usuarios.findMany({
        where: { guid: { in: contactGuids } },
        select: { guid: true, nombre: true, apellido: true, email: true, rol: true },
      }),
      // Fetch all messages between current user and contacts (most recent first)
      this.prisma.lms_mensajes.findMany({
        where: {
          OR: [
            { remitente_guid: usuario_guid, destinatario_guid: { in: contactGuids } },
            { remitente_guid: { in: contactGuids }, destinatario_guid: usuario_guid },
          ],
        },
        orderBy: { created_at: 'desc' },
        select: { remitente_guid: true, destinatario_guid: true, contenido: true, created_at: true },
      }),
      // Batch unread counts
      this.prisma.lms_mensajes.groupBy({
        by: ['remitente_guid'],
        where: {
          remitente_guid: { in: contactGuids },
          destinatario_guid: usuario_guid,
          leido: false,
        },
        _count: true,
      }),
    ]);

    // Build lookup maps from batch results
    const unreadMap = new Map<string, number>();
    for (const uc of unreadCounts) {
      unreadMap.set(uc.remitente_guid, uc._count);
    }

    const lastMsgMap = new Map<string, { contenido: string; created_at: Date }>();
    for (const msg of allMessages) {
      const contactGuid = msg.remitente_guid === usuario_guid ? msg.destinatario_guid : msg.remitente_guid;
      if (!lastMsgMap.has(contactGuid)) {
        lastMsgMap.set(contactGuid, { contenido: msg.contenido, created_at: msg.created_at });
      }
    }

    const result = usuarios.map(u => {
      const lastMsg = lastMsgMap.get(u.guid);
      return {
        guid: u.guid,
        nombre: u.nombre,
        apellido: u.apellido,
        rol: u.rol,
        ultimo_mensaje: lastMsg?.contenido || '',
        ultimo_mensaje_fecha: lastMsg?.created_at?.toISOString() || new Date().toISOString(),
        no_leidos: unreadMap.get(u.guid) || 0,
      };
    });

    // Sort by last message date
    result.sort((a, b) => new Date(b.ultimo_mensaje_fecha).getTime() - new Date(a.ultimo_mensaje_fecha).getTime());

    return result;
  }
}
