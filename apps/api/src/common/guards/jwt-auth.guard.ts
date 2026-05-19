import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
  OnModuleDestroy,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenBlacklistService } from '../../auth/token-blacklist.service';

@Injectable()
export class JwtAuthGuard implements CanActivate, OnModuleDestroy {
  // Throttle ultimo_acceso updates: max once every 5 minutes per user
  private lastAccessUpdates = new Map<string, number>();
  private static readonly ACCESS_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private reflector: Reflector,
    private prisma: PrismaService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {
    // PERF-03: Periodically clean up stale entries to prevent memory leak
    this.cleanupInterval = setInterval(
      () => {
        const cutoff = Date.now() - 10 * 60 * 1000; // 10 minutes
        for (const [guid, timestamp] of this.lastAccessUpdates) {
          if (timestamp < cutoff) this.lastAccessUpdates.delete(guid);
        }
      },
      60 * 60 * 1000,
    ); // Every hour
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    let payload: JwtPayload | null = null;

    if (token) {
      try {
        payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });

        // Check if the user's tokens have been revoked (e.g., after deletion)
        if (payload.sub && payload.iat) {
          if (this.tokenBlacklistService.isRevoked(payload.sub, payload.iat)) {
            if (!isPublic) {
              throw new UnauthorizedException('Sesión revocada. Tu cuenta ha sido eliminada o tu sesión fue cerrada.');
            }
            // On public routes, just don't set user
            payload = null;
          }
        }

        // Verify user still exists in database and is active
        if (payload?.sub) {
          const dbUser = await this.prisma.usuarios.findUnique({
            where: { guid: payload.sub },
            select: { guid: true, activo: true, rol: true },
          });

          if (!dbUser) {
            if (!isPublic) {
              throw new UnauthorizedException('Tu cuenta ya no existe en el sistema.');
            }
            payload = null;
          } else if (!dbUser.activo) {
            if (!isPublic) {
              throw new UnauthorizedException('Tu cuenta ha sido desactivada.');
            }
            payload = null;
          } else {
            // Sync role from DB (in case admin changed it)
            request.user = { ...payload, role: dbUser.rol };

            // Throttled update: only write ultimo_acceso if >5min since last write
            const now = Date.now();
            const lastUpdate = this.lastAccessUpdates.get(payload.sub) || 0;
            if (now - lastUpdate > JwtAuthGuard.ACCESS_UPDATE_INTERVAL_MS) {
              this.lastAccessUpdates.set(payload.sub, now);
              this.prisma.usuarios
                .update({
                  where: { guid: payload.sub },
                  data: { ultimo_acceso: new Date() },
                })
                .catch((err) => Logger.error('Error updating ultimo_acceso', err, 'JwtAuthGuard'));
            }
          }
        }
      } catch (err) {
        if (!isPublic) {
          if (err instanceof UnauthorizedException) throw err;
          throw new UnauthorizedException('Token inválido o expirado.');
        }
      }
    } else if (!isPublic) {
      throw new UnauthorizedException('Token de autenticación requerido.');
    }

    return true;
  }

  private extractTokenFromHeader(request: { headers: { authorization?: string } }): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) return token;

    return undefined;
  }
}
