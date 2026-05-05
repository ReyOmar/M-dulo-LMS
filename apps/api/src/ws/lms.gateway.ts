import { Injectable } from '@nestjs/common';
import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
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
 */
@WebSocketGateway({ path: '/ws' })
@Injectable()
export class LmsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private clients: ConnectedClient[] = [];
  private courseEditors: Map<string, CourseEditor> = new Map();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: WebSocket, req: IncomingMessage): Promise<void> {
    try {
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
      }

      const connectedClient: ConnectedClient = {
        socket: client,
        guid: payload?.sub || `guest-${Math.random().toString(36).substring(7)}`,
        role: payload?.role || 'GUEST',
      };

      this.clients.push(connectedClient);

      // Only notify presence for authenticated users
      if (payload?.sub) {
        this.broadcast('presence:update', {
          guid: payload.sub,
          status: 'online',
          onlineUsers: this.getOnlineUserGuids(),
        });
      }

      // Send current course editing state to the newly connected client
      if (this.courseEditors.size > 0) {
        const editingState: Record<string, CourseEditor> = {};
        this.courseEditors.forEach((editor, cursoGuid) => {
          editingState[cursoGuid] = editor;
        });
        const syncMsg = JSON.stringify({ event: 'course:editing-sync', data: editingState, timestamp: Date.now() });
        try { client.send(syncMsg); } catch {}
      }

      // Listen for incoming messages from this client (course:lock / course:unlock)
      client.on('message', async (raw: WebSocket.Data) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.action === 'course:lock' && msg.curso_guid && connectedClient.guid) {
            // Look up user name
            let nombre = 'Usuario';
            try {
              const u = await this.prisma.usuarios.findUnique({ where: { guid: connectedClient.guid }, select: { nombre: true, apellido: true } });
              if (u) nombre = `${u.nombre} ${u.apellido}`;
            } catch {}
            const rolLabel = connectedClient.role === 'ADMINISTRADOR' ? 'Administrador' : 'Examinador';
            const editor: CourseEditor = { guid: connectedClient.guid, role: rolLabel, nombre };
            this.courseEditors.set(msg.curso_guid, editor);
            this.broadcast('course:editing', { curso_guid: msg.curso_guid, editor });
          }
          if (msg.action === 'course:unlock' && msg.curso_guid) {
            const current = this.courseEditors.get(msg.curso_guid);
            if (current && current.guid === connectedClient.guid) {
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

  handleDisconnect(client: WebSocket): void {
    const index = this.clients.findIndex(c => c.socket === client);
    if (index !== -1) {
      const disconnectedGuid = this.clients[index].guid;
      this.clients.splice(index, 1);

      // Check if user has other active connections
      const stillConnected = this.clients.some(c => c.guid === disconnectedGuid);
      if (!stillConnected) {
        this.broadcast('presence:update', {
          guid: disconnectedGuid,
          status: 'offline',
          onlineUsers: this.getOnlineUserGuids(),
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

  /**
   * Get list of unique online user GUIDs
   */
  getOnlineUserGuids(): string[] {
    return [...new Set(this.clients.map(c => c.guid))];
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
        console.error(`WS send error to ${client.guid}:`, err);
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
        console.error(`WS send error to ${client.guid}:`, err);
      }
    }
  }

  /**
   * Force disconnect a user (e.g., when their account is deleted).
   * Sends a session:revoked event before closing.
   */
  forceDisconnect(guid: string, reason: string = 'account_deleted'): void {
    const userClients = this.clients.filter(c => c.guid === guid);
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
    this.clients = this.clients.filter(c => c.guid !== guid);
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
