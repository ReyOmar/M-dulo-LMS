import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UnauthorizedException,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { QuizService } from '../cursos/quiz.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CalificarEntregaDto } from './dto/calificar-entrega.dto';

@Controller('evaluaciones')
export class EvaluacionesController {
  constructor(
    private readonly evaluacionesService: EvaluacionesService,
    private readonly quizService: QuizService,
  ) {}

  /**
   * Submit a file for a task via multipart/form-data.
   * Expects a 'file' field with the uploaded file.
   */
  @Post('/tareas/:tarea_guid/entregas')
  async submitEntrega(
    @CurrentUser() user: JwtPayload,
    @Param('tarea_guid') tarea_guid: string,
    @Req() req: { file: () => Promise<{ file: AsyncIterable<Buffer>; filename?: string } | null> },
  ) {
    const userGuid = user.sub;
    if (!userGuid) throw new UnauthorizedException('Debes iniciar sesión para subir tu tarea.');

    // SEC-06: Verify enrollment before allowing file submission
    await this.quizService.verificarMatricula(tarea_guid, userGuid);

    const data = await req.file();
    if (!data) {
      throw new BadRequestException('No se envió ningún archivo.');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      throw new BadRequestException('El archivo está vacío.');
    }

    return this.evaluacionesService.submitEntrega(tarea_guid, {
      buffer,
      nombre_archivo: data.filename || 'archivo.bin',
      usuario_guid: userGuid,
    });
  }

  @Get('/tareas/:tarea_guid/entregas/mine')
  async getEntrega(@CurrentUser() user: JwtPayload, @Param('tarea_guid') tarea_guid: string) {
    const userGuid = user.sub;
    if (!userGuid) throw new UnauthorizedException('Usuario no autenticado correctamente.');
    const entrega = await this.evaluacionesService.getEntrega(tarea_guid, userGuid);
    return entrega || { estado: 'PENDIENTE' };
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Get('/tareas/:tarea_guid/entregas')
  async getTodasEntregasParaTarea(@Param('tarea_guid') tarea_guid: string, @CurrentUser() user: JwtPayload) {
    return this.evaluacionesService.getTodasEntregasParaTarea(tarea_guid, user.sub, user.role);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Get('/examiner/entregas')
  async getEntregasParaCalificar(@CurrentUser() user: JwtPayload) {
    // BUG-07 FIX: Use the authenticated user's GUID from JWT instead of an untrusted query param.
    // This prevents a professor from viewing another professor's submissions.
    return this.evaluacionesService.getEntregasParaCalificar(user.sub);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Patch('/entregas/:guid/calificar')
  async calificarEntrega(
    @Param('guid') guid: string,
    @Body() body: CalificarEntregaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Pass professor's GUID for ownership verification
    return this.evaluacionesService.calificarEntrega(guid, body, user.sub, user.role);
  }
}
