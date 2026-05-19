import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { WsTokenService } from './ws-token.service';
import { IncomingMessage } from 'http';
import * as WebSocket from 'ws';
import { LmsWsEvent } from './ws-events.types';

interface CourseEditor {
  guid: string;
  role: string;
  nombre: string;
}

/** Extended WebSocket with heartbeat tracking */
interface HeartbeatSocket extends WebSocket {
  isAlive?: boolean;
}

interface ConnectedClient {
  socket: HeartbeatSocket;
  guid: string;
  role: string;
  /** Short hash of the session token — used to detect new login vs reconnect. Never stores the full token. */
  sessionHash: string;
}

/**
 * Central WebSocket gateway for real-time LMS communication.
 *
 * Authentication flow (SEC):
 * 1. Client calls POST /api/auth/ws-token to get a 30-second single-use ephemeral token
 * 2. Client connects to ws://.../ws?token=<ephemeral_token>
 * 3. Gateway consumes the ephemeral token via WsTokenService
 * 4. JWT tokens in query string are rejected (no fallback)
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
    private wsTokenService: WsTokenService,
  ) {}

  onModuleInit() {
    // Check for ghost connections every 15 seconds
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((c) => {
        if (c.socket.isAlive === false) {
          return c.socket.terminate();
        }
        c.socket.isAlive = false;
        c.socket.ping();
      });
    }, 15000);
  }

  // Clean up heartbeat interval to prevent leaks
  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Authenticate and register a new WebSocket connection.
   * Only accepts ephemeral tokens issued by POST /api/auth/ws-token.
   * JWT tokens in query string are rejected to prevent token leakage.
   */
  async handleConnection(client: WebSocket, req: IncomingMessage): Promise<void> {
    try {
      // Setup heartbeat for this connection
      (client as HeartbeatSocket).isAlive = true;
      client.on('pong', () => {
        (client as HeartbeatSocket).isAlive = true;
      });
      const url = new URL(req.url || '', 'http://localhost');
      const rawToken = url.searchParams.get('token');

      if (!rawToken) {
        client.close(4001, 'Autenticación requerida');
        return;
      }

      let userGuid: string;
      let userRole: string;
      let sessionHash: string;

      // Strategy 1: Consume ephemeral WS token (single-use, 30s TTL)
      const ephemeral = this.wsTokenService.consumeToken(rawToken);

      if (ephemeral) {
        userGuid = ephemeral.userGuid;
        userRole = ephemeral.userRole;
        // SEC: Use the JWT-derived hash as session identifier — it's stable across
        // page refreshes (same JWT = same hash), so reconnects won't trigger revocation.
        // Only a genuine new login (different JWT) will produce a different sessionHash.
        sessionHash = ephemeral.jwtHash;
      } else {
        // SEC: JWT tokens in query string are no longer accepted.
        // Clients must use POST /api/auth/ws-token to get an ephemeral token first.
        this.logger.warn('WS connection rejected: invalid or expired ephemeral token');
        client.close(4002, 'Token inválido o expirado. Solicita un nuevo token efímero.');
        return;
      }

      // Verify user still exists and is active
      const dbUser = await this.prisma.usuarios.findUnique({
        where: { guid: userGuid },
        select: { activo: true },
      });
      if (!dbUser || !dbUser.activo) {
        client.close(4003, 'Usuario inactivo o eliminado');
        return;
      }

      const connectedClient: ConnectedClient = {
        socket: client,
        guid: userGuid,
        role: userRole,
        sessionHash,
      };

      // ── Enforce single session: revoke previous connections only on REAL new logins ──
      const existingConnections = this.clients.filter((c) => c.guid === userGuid);
      // Check if this is a page refresh (same session hash) or a genuine new login (different hash)
      const isNewLogin =
        existingConnections.length > 0 && existingConnections.some((c) => c.sessionHash !== sessionHash);

      for (const existing of existingConnections) {
        if (isNewLogin && existing.sessionHash !== sessionHash) {
          // Different session = real new login → revoke old session
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
          // Same session = page refresh / reconnect → close silently without revocation
          try {
            existing.socket.close(1000, 'Reconnecting');
          } catch {}
        }
      }
      this.clients = this.clients.filter((c) => c.guid !== userGuid);

      this.clients.push(connectedClient);

      this.logger.log(
        `WS connected: ${userGuid.slice(0, 8)}... (${userRole}) — Total clients: ${this.clients.length}, Online GUIDs: [${this.getOnlineUserGuids()
          .map((g) => g.slice(0, 8))
          .join(', ')}]`,
      );

      // Update ultimo_acceso on connect so the admin table shows fresh timestamps
      try {
        await this.prisma.usuarios.update({
          where: { guid: userGuid },
          data: { ultimo_acceso: new Date() },
        });
      } catch (e) {
        this.logger.error('Error updating ultimo_acceso on connect', e);
      }

      // Only send affected user status in broadcast (not full online list)
      this.broadcast('presence:update', {
        guid: userGuid,
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

      // Notify admin dashboards so charts refresh when users connect
      this.broadcastToRole('dashboard:refresh', { reason: 'user_connected' }, 'ADMINISTRADOR');

      // Listen for incoming messages from this client (course:lock / course:unlock)
      client.on('message', async (raw: WebSocket.Data) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.action === 'course:lock' && msg.curso_guid && connectedClient.guid) {
            // Only ADMINISTRADOR and PROFESOR can lock courses
            if (connectedClient.role !== 'ADMINISTRADOR' && connectedClient.role !== 'PROFESOR') {
              return; // Silently ignore — students cannot lock courses
            }

            // PROFESOR must own the course
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
            // Only the current editor or an admin can unlock
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
        this.logger.log(
          `WS disconnected: ${disconnectedGuid.slice(0, 8)}... — stillConnected=${stillConnected}, Total clients: ${this.clients.length}`,
        );
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

          // Only send affected user status in broadcast (not full online list)
          this.broadcast('presence:update', {
            guid: disconnectedGuid,
            status: 'offline',
          });

          // Notify admin dashboards so charts stay in sync
          this.broadcastToRole('dashboard:refresh', { reason: 'user_disconnected' }, 'ADMINISTRADOR');

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
   * Check if a specific user is currently connected via WebSocket.
   */
  isUserOnline(guid: string): boolean {
    return this.clients.some((c) => c.guid === guid && c.socket.readyState === WebSocket.OPEN);
  }

  /**
   * Broadcast an event to all connected clients, or to specific users.
   * @param event - Event name
   * @param data - Event payload
   * @param targetGuids - If provided, only send to these users
   */
  broadcast(event: LmsWsEvent, data: Record<string, unknown>, targetGuids?: string[]): void {
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
  broadcastToRole(event: LmsWsEvent, data: Record<string, unknown>, role: string): void {
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
