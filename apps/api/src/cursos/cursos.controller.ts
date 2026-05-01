import { Controller, Get, Post, Body, Param, Patch, Delete, Query, BadRequestException } from '@nestjs/common';
import { CursosService } from './cursos.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCursoDto, AsignarCursoDto, UpdateCursoDto, CreateModuloDto, UpdateModuloDto } from './dto/cursos.dto';
import { CreateBloqueDto, UpdateBloqueDto } from './dto/bloques.dto';

@Public()
@Controller('cursos')
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @Get()
  async getCursos(
    @CurrentUser() user: any, 
    @Query('role') roleParam?: string, 
    @Query('usuario_guid') usuario_guid?: string,
    @Query('profesor_guid') profesor_guid?: string
  ) {
    // When JWT user is available, use their role directly; otherwise use query params
    const userRole = user?.role || user?.rol || (roleParam === 'admin' ? 'ADMINISTRADOR' : roleParam === 'teacher' ? 'PROFESOR' : roleParam === 'student' ? 'ESTUDIANTE' : null);
    const userGuid = user?.sub || user?.guid || usuario_guid || profesor_guid;

    if (userRole === 'ESTUDIANTE' && userGuid) {
      return this.cursosService.getCursosDeEstudiante(userGuid);
    } else if (userRole === 'PROFESOR' && userGuid) {
      return this.cursosService.getCursosDeProfesor(userGuid);
    } else if (userRole === 'ADMINISTRADOR') {
      return this.cursosService.getAllCursosParaAdmin();
    }
    return this.cursosService.getCursosActivosParaEstudiante();
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
  @Patch('/:guid')
  async updateCurso(@Param('guid') guid: string, @Body() body: UpdateCursoDto) {
    return this.cursosService.updateCurso(guid, body);
  }

  @Roles('ADMINISTRADOR')
  @Delete('/:guid')
  async deleteCurso(@Param('guid') guid: string) {
    return this.cursosService.deleteCurso(guid);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Post('/:curso_guid/modulos')
  async createModulo(@Param('curso_guid') curso_guid: string, @Body() body: CreateModuloDto) {
    return this.cursosService.createModuloParaCurso(curso_guid, body);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Patch('/modulos/:modulo_guid')
  async updateModulo(@Param('modulo_guid') modulo_guid: string, @Body() body: UpdateModuloDto) {
    return this.cursosService.updateModulo(modulo_guid, body);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Delete('/modulos/:modulo_guid')
  async deleteModulo(@Param('modulo_guid') modulo_guid: string) {
    return this.cursosService.deleteModulo(modulo_guid);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Post('/modulos/:modulo_guid/bloques')
  async addBloque(@Param('modulo_guid') modulo_guid: string, @Body() body: CreateBloqueDto) {
    return this.cursosService.addBloqueToModulo(modulo_guid, body);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Get('/bloques/:bloque_guid')
  async getBloque(@Param('bloque_guid') bloque_guid: string) {
    return this.cursosService.getBloque(bloque_guid);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Patch('/bloques/:bloque_guid')
  async updateBloque(@Param('bloque_guid') bloque_guid: string, @Body() body: UpdateBloqueDto) {
    return this.cursosService.updateBloque(bloque_guid, body);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Delete('/bloques/:bloque_guid')
  async deleteBloque(@Param('bloque_guid') bloque_guid: string) {
    return this.cursosService.deleteBloque(bloque_guid);
  }

  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Patch('/modulos/:modulo_guid/recursos/reorder')
  async reorderBloques(@Param('modulo_guid') modulo_guid: string, @Body() body: { recursos_guids: string[] }) {
    if (!body.recursos_guids || !Array.isArray(body.recursos_guids)) {
      throw new BadRequestException('recursos_guids debe ser un arreglo de strings.');
    }
    return this.cursosService.reorderBloques(modulo_guid, body.recursos_guids);
  }

  @Post('/student/quiz/:bloque_guid/start')
  async startQuiz(@Param('bloque_guid') bloque_guid: string, @Query('usuario_guid') usuario_guid: string, @CurrentUser() user: any) {
    const finalGuid = user?.guid || usuario_guid;
    if (!finalGuid) {
        throw new BadRequestException('usuario_guid es requerido.');
    }
    return this.cursosService.startQuiz(bloque_guid, finalGuid);
  }

  @Post('/student/quiz/:bloque_guid/submit')
  async submitQuiz(@Param('bloque_guid') bloque_guid: string, @Body() body: any, @Query('usuario_guid') usuario_guid: string, @CurrentUser() user: any) {
    const finalGuid = user?.guid || usuario_guid;
    if (!finalGuid) {
        throw new BadRequestException('usuario_guid es requerido.');
    }
    return this.cursosService.evaluarQuiz(bloque_guid, finalGuid, body.respuestas || {});
  }

  @Get('/student/quiz/:bloque_guid/status')
  async getQuizStatus(@Param('bloque_guid') bloque_guid: string, @Query('usuario_guid') usuario_guid: string, @CurrentUser() user: any) {
    const finalGuid = user?.guid || usuario_guid;
    if (!finalGuid) {
        throw new BadRequestException('usuario_guid es requerido.');
    }
    return this.cursosService.getQuizStatus(bloque_guid, finalGuid);
  }
}
