import { Controller, Get, Post, Body, Param, Patch, Delete, Query, BadRequestException } from '@nestjs/common';
import { CursosService } from './cursos.service';
import { QuizService } from './quiz.service';
import { BloqueService } from './bloque.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateCursoDto, AsignarCursoDto, UpdateCursoDto, CreateModuloDto, UpdateModuloDto } from './dto/cursos.dto';
import { CreateBloqueDto, UpdateBloqueDto } from './dto/bloques.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@Controller('cursos')
export class CursosController {
  constructor(
    private readonly cursosService: CursosService,
    private readonly quizService: QuizService,
    private readonly bloqueService: BloqueService,
  ) {}

  // ── Course Listing ──

  @Get()
  async getCursos(@CurrentUser() user: JwtPayload) {
    const userRole = user?.role;
    const userGuid = user?.sub;

    if (!userRole || !userGuid) {
      throw new BadRequestException('Sesión inválida. Por favor inicia sesión nuevamente.');
    }

    if (userRole === 'ESTUDIANTE') {
      return this.cursosService.getCursosDeEstudiante(userGuid);
    } else if (userRole === 'PROFESOR') {
      return this.cursosService.getCursosDeProfesor(userGuid);
    } else if (userRole === 'ADMINISTRADOR') {
      return this.cursosService.getAllCursosParaAdmin();
    }

    throw new BadRequestException(`Rol no reconocido: ${userRole}`);
  }

  @Get('/usuario-cursos')
  async getCursosPorUsuario(@Query('usuario_guid') usuario_guid: string, @Query('rol') rol: string) {
    if (rol === 'ESTUDIANTE') {
        return this.cursosService.getCursosDeEstudianteConFecha(usuario_guid);
    } else if (rol === 'PROFESOR') {
        return this.cursosService.getCursosDeProfesorConFecha(usuario_guid);
    }
    return [];
  }

  @Roles('ADMINISTRADOR')
  @Get('/profesores')
  async getProfesores() {
    return this.cursosService.getProfesores();
  }

  @Get('/:guid')
  async getCurso(@Param('guid') guid: string) {
    return this.cursosService.getCursoDetalleCompleto(guid);
  }

  // ── Course CRUD ──

  @Roles('ADMINISTRADOR')
  @Post()
  async createCurso(@Body() body: CreateCursoDto) {
    return this.cursosService.createCurso(body);
  }

  @Roles('ADMINISTRADOR')
  @Post('/:guid/asignar')
  async asignarCurso(@Param('guid') guid: string, @Body() body: AsignarCursoDto) {
    return this.cursosService.asignarCurso(guid, body.profesor_guid);
  }

  @Roles('ADMINISTRADOR')
  @Post('/:guid/desasignar')
  async desasignarCurso(@Param('guid') guid: string, @CurrentUser() user: JwtPayload) {
    const adminGuid = user.sub;
    if (!adminGuid) throw new BadRequestException('Falta guid del administrador');
    return this.cursosService.desasignarCurso(guid, adminGuid);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Patch('/:guid')
  async updateCurso(@Param('guid') guid: string, @Body() body: UpdateCursoDto, @CurrentUser() user: JwtPayload) {
    return this.cursosService.updateCurso(guid, body, user);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Delete('/:guid')
  async deleteCurso(@Param('guid') guid: string) {
    return this.cursosService.deleteCurso(guid);
  }

  // ── Module management (delegated to BloqueService) ──

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Post('/:curso_guid/modulos')
  async createModulo(@Param('curso_guid') curso_guid: string, @Body() body: CreateModuloDto) {
    return this.bloqueService.createModuloParaCurso(curso_guid, body);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Patch('/modulos/:modulo_guid')
  async updateModulo(@Param('modulo_guid') modulo_guid: string, @Body() body: UpdateModuloDto) {
    return this.bloqueService.updateModulo(modulo_guid, body);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Delete('/modulos/:modulo_guid')
  async deleteModulo(@Param('modulo_guid') modulo_guid: string) {
    return this.bloqueService.deleteModulo(modulo_guid);
  }

  // ── Block (recurso) management (delegated to BloqueService) ──

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Post('/modulos/:modulo_guid/bloques')
  async addBloque(@Param('modulo_guid') modulo_guid: string, @Body() body: CreateBloqueDto) {
    return this.bloqueService.addBloqueToModulo(modulo_guid, body);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Get('/bloques/:bloque_guid')
  async getBloque(@Param('bloque_guid') bloque_guid: string) {
    return this.bloqueService.getBloque(bloque_guid);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Patch('/bloques/:bloque_guid')
  async updateBloque(@Param('bloque_guid') bloque_guid: string, @Body() body: UpdateBloqueDto) {
    return this.bloqueService.updateBloque(bloque_guid, body);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Delete('/bloques/:bloque_guid')
  async deleteBloque(@Param('bloque_guid') bloque_guid: string) {
    return this.bloqueService.deleteBloque(bloque_guid);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Patch('/modulos/:modulo_guid/recursos/reorder')
  async reorderBloques(@Param('modulo_guid') modulo_guid: string, @Body() body: { recursos_guids: string[] }) {
    if (!body.recursos_guids || !Array.isArray(body.recursos_guids)) {
      throw new BadRequestException('recursos_guids debe ser un arreglo de strings.');
    }
    return this.bloqueService.reorderBloques(modulo_guid, body.recursos_guids);
  }

  // ── Quiz endpoints (delegated to QuizService) ──

  @Post('/student/quiz/:bloque_guid/start')
  async startQuiz(@Param('bloque_guid') bloque_guid: string, @CurrentUser() user: JwtPayload) {
    await this.quizService.verificarMatricula(bloque_guid, user.sub);
    return this.quizService.startQuiz(bloque_guid, user.sub);
  }

  @Post('/student/quiz/:bloque_guid/submit')
  async submitQuiz(@Param('bloque_guid') bloque_guid: string, @Body() body: SubmitQuizDto, @CurrentUser() user: JwtPayload) {
    await this.quizService.verificarMatricula(bloque_guid, user.sub);
    return this.quizService.evaluarQuiz(bloque_guid, user.sub, body.respuestas);
  }

  @Get('/student/quiz/:bloque_guid/status')
  async getQuizStatus(@Param('bloque_guid') bloque_guid: string, @CurrentUser() user: JwtPayload) {
    return this.quizService.getQuizStatus(bloque_guid, user.sub);
  }
}
