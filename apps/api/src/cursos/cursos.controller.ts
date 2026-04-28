import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { CursosService } from './cursos.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCursoDto, AsignarCursoDto, UpdateCursoDto, CreateModuloDto, UpdateModuloDto } from './dto/cursos.dto';
import { CreateBloqueDto, UpdateBloqueDto } from './dto/bloques.dto';

@Controller('cursos')
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @Get()
  async getCursos(@CurrentUser() user: any) {
    if (user?.rol === 'ESTUDIANTE') {
      return this.cursosService.getCursosDeEstudiante(user.guid);
    } else if (user?.rol === 'PROFESOR') {
      return this.cursosService.getCursosDeProfesor(user.guid);
    } else if (user?.rol === 'ADMINISTRADOR') {
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
}
