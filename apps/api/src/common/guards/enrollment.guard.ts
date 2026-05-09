import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * EnrollmentGuard — Verifies that the authenticated user is enrolled
 * in the course that contains the resource referenced by the route param.
 * 
 * Usage: Apply on routes that have a param like :tarea_guid or :bloque_guid
 * referencing a resource (lms_recursos). The guard traverses
 * recurso → leccion → modulo → curso and checks lms_matriculas.
 * 
 * Example:
 *   @UseGuards(EnrollmentGuard)
 *   @Post('/student/quiz/:bloque_guid/start')
 */
@Injectable()
export class EnrollmentGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.sub) {
      throw new BadRequestException('Sesión inválida.');
    }

    // Resolve the resource GUID from route params
    const recurso_guid =
      request.params.bloque_guid ||
      request.params.tarea_guid ||
      request.params.recurso_guid;

    if (!recurso_guid) {
      // No resource param found — skip guard (let the handler deal with it)
      return true;
    }

    // Traverse: recurso → leccion → modulo → curso
    const recurso = await this.prisma.lms_recursos.findUnique({
      where: { guid: recurso_guid },
      select: {
        leccion: {
          select: {
            modulo: {
              select: { curso_guid: true }
            }
          }
        }
      }
    });

    if (!recurso) {
      throw new BadRequestException('Recurso no encontrado.');
    }

    const curso_guid = recurso.leccion.modulo.curso_guid;

    const matricula = await this.prisma.lms_matriculas.findUnique({
      where: {
        usuario_guid_curso_guid: { usuario_guid: user.sub, curso_guid }
      }
    });

    if (!matricula) {
      throw new BadRequestException('No estás matriculado en este curso.');
    }

    return true;
  }
}
