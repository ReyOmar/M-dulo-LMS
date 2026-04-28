import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { MatriculasService } from './matriculas.service';
import { Roles } from '../common/decorators/roles.decorator';
import { MatricularEstudianteDto } from './dto/matricular.dto';

@Controller('cursos')
export class MatriculasController {
  constructor(private readonly matriculasService: MatriculasService) {}

  @Roles('ADMINISTRADOR')
  @Post('/seed-matriculas')
  async seedMatriculas() {
    return this.matriculasService.seedMatriculas();
  }

  @Roles('ADMINISTRADOR')
  @Get('/estudiantes')
  async getEstudiantes() {
    return this.matriculasService.getEstudiantesDisponibles();
  }

  @Roles('ADMINISTRADOR')
  @Get('/matriculas/:curso_guid')
  async getMatriculasCurso(@Param('curso_guid') curso_guid: string) {
    return this.matriculasService.getMatriculasCurso(curso_guid);
  }

  @Roles('ADMINISTRADOR')
  @Post('/matriculas/:curso_guid')
  async matricularEstudiante(@Param('curso_guid') curso_guid: string, @Body() body: MatricularEstudianteDto) {
    return this.matriculasService.matricularEstudiante(curso_guid, body.usuario_guid);
  }

  @Roles('ADMINISTRADOR')
  @Delete('/matriculas/:curso_guid/:usuario_guid')
  async desmatricularEstudiante(@Param('curso_guid') curso_guid: string, @Param('usuario_guid') usuario_guid: string) {
    return this.matriculasService.desmatricularEstudiante(curso_guid, usuario_guid);
  }
}
