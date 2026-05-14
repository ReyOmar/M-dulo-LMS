import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { IncomingMessage } from 'http';
import * as WebSocket from 'ws';

interface CourseEditor {
  guid: string;
  role: string;
  nombre: string;
}

interface ConnectedClient {
  socket: WebSocket;
  guid: string;
  role: string;
  token: string;
}

/**
 * Central WebSocket gateway for real-time LMS communication.
 *
 * Authenticates connections via JWT token in query string.
 * Provides methods for broadcasting events to all or specific users.
 *
 * Events emitted:
 * - session:revoked — Force logout (user deleted/deactivated)
 * - user:deleted — User was removed from the system
 * - user:created — New user approved
 * - request:new — New access request submitted
 * - request:resolved — Access request approved/rejected
 * - course:updated — Course content changed
 * - course:created — New course created
 * - course:deleted — Course removed
 * - enrollment:changed — Student enrolled/unenrolled
 * - submission:new — New assignment submission
 * - submission:graded — Assignment graded
 * - config:updated — Platform configuration changed
 * - presence:update — User connected/disconnected
 * - dashboard:refresh — Generic signal to refresh dashboard data
 * - certificate:new — Student completed a course and certificate was generated
 */
@WebSocketGateway({ path: '/ws' })
@Injectable()
export class LmsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  private clients: ConnectedClient[] = [];
  private readonly logger = new Logger(LmsGateway.name);
  private courseEditors: Map<string, CourseEditor> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {}

  onModuleInit() {
    // F9.5: Check for ghost connections every 15 seconds
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((c) => {
        if ((c.socket as any).isAlive === false) {
          return c.socket.terminate();
        }
        (c.socket as any).isAlive = false;
        c.socket.ping();
      });
    }, 15000);
  }

  // F9.5: Clean up heartbeat interval to prevent leaks
  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async handleConnection(client: WebSocket, req: IncomingMessage): Promise<void> {
    try {
      // Setup heartbeat for this connection
      (client as any).isAlive = true;
      client.on('pong', () => {
        (client as any).isAlive = true;
      });
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');

      let payload: any = null;
      if (token) {
        payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });

        if (!payload?.sub) {
          client.close(4002, 'Token inválido');
          return;
        }

        // F2.2: Check if token has been revoked (post-logout/password-change)
        if (payload.iat && this.tokenBlacklistService.isRevoked(payload.sub, payload.iat)) {
          client.close(4004, 'Sesión revocada');
          return;
        }

        // Verify user still exists and is active
        const dbUser = await this.prisma.usuarios.findUnique({
          where: { guid: payload.sub },
          select: { activo: true },
        });
        if (!dbUser || !dbUser.activo) {
          client.close(4003, 'Usuario inactivo o eliminado');
          return;
        }
      } else {
        client.close(4001, 'Autenticación requerida');
        return;
      }

      const connectedClient: ConnectedClient = {
        socket: client,
        guid: payload.sub,
        role: payload.role || 'ESTUDIANTE',
        token,
      };

      // ── Enforce single session: revoke previous connections only on REAL new logins ──
      const existingConnections = this.clients.filter((c) => c.guid === payload.sub);
      // Check if this is a page refresh (same token) or a genuine new login (different token)
      const isNewLogin = existingConnections.length > 0 && existingConnections.some((c) => c.token !== token);

      for (const existing of existingConnections) {
        if (isNewLogin && existing.token !== token) {
          // Different token = real new login → revoke old session
          const revokeMsg = JSON.stringify({
            event: 'session:revoked',
            data: { reason: 'new_session' },
            timestamp: Date.now(),
          });
          try {
            existing.socket.send(revokeMsg);
          } catch {}
          try {
            existing.socket.close(4004, 'Nueva sesión iniciada');
          } catch {}
        } else {
          // Same token = page refresh / reconnect → close silently without revocation
          try {
            existing.socket.close(1000, 'Reconnecting');
          } catch {}
        }
      }
      this.clients = this.clients.filter((c) => c.guid !== payload.sub);

      this.clients.push(connectedClient);
      // F3.8: Only send affected user status in broadcast (not full online list)
      this.broadcast('presence:update', {
        guid: payload.sub,
        status: 'online',
      });

      // Send current course editing state to the newly connected client
      if (this.courseEditors.size > 0) {
        const editingState: Record<string, CourseEditor> = {};
        this.courseEditors.forEach((editor, cursoGuid) => {
          editingState[cursoGuid] = editor;
        });
        const syncMsg = JSON.stringify({ event: 'course:editing-sync', data: editingState, timestamp: Date.now() });
        try {
          client.send(syncMsg);
        } catch {}
      }

      // Send full online users list to the newly connected client (presence sync)
      const presenceSync = JSON.stringify({
        event: 'presence:sync',
        data: { onlineUsers: this.getOnlineUserGuids() },
        timestamp: Date.now(),
      });
      try {
        client.send(presenceSync);
      } catch {}

      // Listen for incoming messages from this client (course:lock / course:unlock)
      client.on('message', async (raw: WebSocket.Data) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.action === 'course:lock' && msg.curso_guid && connectedClient.guid) {
            // F9.10: Only ADMINISTRADOR and PROFESOR can lock courses
            if (connectedClient.role !== 'ADMINISTRADOR' && connectedClient.role !== 'PROFESOR') {
              return; // Silently ignore — students cannot lock courses
            }

            // F9.10: PROFESOR must own the course
            if (connectedClient.role === 'PROFESOR') {
              try {
                const course = await this.prisma.lms_cursos.findUnique({
                  where: { guid: msg.curso_guid },
                  select: { profesor_guid: true },
                });
                if (!course || course.profesor_guid !== connectedClient.guid) {
                  return; // Professor doesn't own this course — silently ignore
                }
              } catch {
                return;
              }
            }

            // Look up user name
            let nombre = 'Usuario';
            try {
              const u = await this.prisma.usuarios.findUnique({
                where: { guid: connectedClient.guid },
                select: { nombre: true, apellido: true },
              });
              if (u) nombre = `${u.nombre} ${u.apellido}`;
            } catch {}
            const rolLabel = connectedClient.role === 'ADMINISTRADOR' ? 'Administrador' : 'Examinador';
            const editor: CourseEditor = { guid: connectedClient.guid, role: rolLabel, nombre };
            this.courseEditors.set(msg.curso_guid, editor);
            this.broadcast('course:editing', { curso_guid: msg.curso_guid, editor });
          }
          if (msg.action === 'course:unlock' && msg.curso_guid) {
            const current = this.courseEditors.get(msg.curso_guid);
            // F9.10: Only the current editor or an admin can unlock
            if (current && (current.guid === connectedClient.guid || connectedClient.role === 'ADMINISTRADOR')) {
              this.courseEditors.delete(msg.curso_guid);
              this.broadcast('course:editing-released', { curso_guid: msg.curso_guid });
            }
          }
        } catch {}
      });
    } catch {
      client.close(4003, 'Autenticación fallida');
    }
  }

  async handleDisconnect(client: WebSocket): Promise<void> {
    const index = this.clients.findIndex((c) => c.socket === client);
    if (index !== -1) {
      const disconnectedGuid = this.clients[index].guid;
      this.clients.splice(index, 1);

      // Clean stale/closed sockets BEFORE checking stillConnected to avoid false positives
      this.clients = this.clients.filter((c) => c.socket.readyState === WebSocket.OPEN);

      // Only process presence for authenticated users (non-empty guid)
      if (disconnectedGuid) {
        // Check if user has other active connections
        const stillConnected = this.clients.some((c) => c.guid === disconnectedGuid);
        if (!stillConnected) {
          // Update database ultimo_acceso BEFORE broadcasting so the frontend fetches the new date
          if (this.prisma) {
            try {
              await this.prisma.usuarios.update({
                where: { guid: disconnectedGuid },
                data: { ultimo_acceso: new Date() },
              });
            } catch (e) {
              this.logger.error('Error updating ultimo_acceso on disconnect', e);
            }
          }

          // F3.8: Only send affected user status in broadcast (not full online list)
          this.broadcast('presence:update', {
            guid: disconnectedGuid,
            status: 'offline',
          });

          // Release any courses this user was editing
          const toRelease: string[] = [];
          this.courseEditors.forEach((editor, cursoGuid) => {
            if (editor.guid === disconnectedGuid) {
              toRelease.push(cursoGuid);
            }
          });
          for (const cursoGuid of toRelease) {
            this.courseEditors.delete(cursoGuid);
            this.broadcast('course:editing-released', { curso_guid: cursoGuid });
          }
        }
      }
    }
  }

  /**
   * Get list of unique online user GUIDs (authenticated users only)
   */
  getOnlineUserGuids(): string[] {
    return [
      ...new Set(this.clients.filter((c) => c.guid && c.socket.readyState === WebSocket.OPEN).map((c) => c.guid)),
    ];
  }

  /**
   * Broadcast an event to all connected clients, or to specific users.
   * @param event - Event name
   * @param data - Event payload
   * @param targetGuids - If provided, only send to these users
   */
  broadcast(event: string, data: any, targetGuids?: string[]): void {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });

    for (const client of this.clients) {
      if (client.socket.readyState !== WebSocket.OPEN) continue;
      if (targetGuids && !targetGuids.includes(client.guid)) continue;
      try {
        client.socket.send(message);
      } catch (err) {
        this.logger.error(`WS send error to ${client.guid}:`, err);
      }
    }
  }

  /**
   * Broadcast to all clients with a specific role.
   */
  broadcastToRole(event: string, data: any, role: string): void {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });

    for (const client of this.clients) {
      if (client.socket.readyState !== WebSocket.OPEN) continue;
      if (client.role !== role) continue;
      try {
        client.socket.send(message);
      } catch (err) {
        this.logger.error(`WS send error to ${client.guid}:`, err);
      }
    }
  }

  /**
   * Force disconnect a user (e.g., when their account is deleted).
   * Sends a session:revoked event before closing.
   */
  forceDisconnect(guid: string, reason: string = 'account_deleted'): void {
    const userClients = this.clients.filter((c) => c.guid === guid);
    for (const client of userClients) {
      try {
        const msg = JSON.stringify({
          event: 'session:revoked',
          data: { reason, message: 'Tu sesión ha sido cerrada.' },
          timestamp: Date.now(),
        });
        client.socket.send(msg);
        client.socket.close(4004, reason);
      } catch {
        // Socket already closed
      }
    }
    this.clients = this.clients.filter((c) => c.guid !== guid);
  }

  /**
   * Release the editing lock for a course.
   * Clears the internal courseEditors Map and broadcasts the release event.
   * Called by services when a course is published to ensure no stale locks.
   */
  releaseCourseEditor(cursoGuid: string): void {
    if (this.courseEditors.has(cursoGuid)) {
      this.courseEditors.delete(cursoGuid);
    }
    this.broadcast('course:editing-released', { curso_guid: cursoGuid });
  }
}
