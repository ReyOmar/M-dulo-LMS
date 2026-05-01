import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenBlacklistService } from '../../auth/token-blacklist.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private reflector: Reflector,
    private prisma: PrismaService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    let payload: any = null;

    if (token) {
      try {
        payload = await this.jwtService.verifyAsync(token, {
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

            // Update ultimo_acceso asynchronously without blocking the request
            this.prisma.usuarios.update({
              where: { guid: payload.sub },
              data: { ultimo_acceso: new Date() }
            }).catch(err => console.error("Error updating ultimo_acceso", err));
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

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
