import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateCursoDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsOptional()
  @IsString()
  profesor_guid?: string;
}

export class AsignarCursoDto {
  @IsString()
  @IsNotEmpty()
  profesor_guid: string;
}

export class UpdateCursoDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  @IsIn(['BORRADOR', 'PUBLICADO', 'ARCHIVADO'], { message: 'Estado debe ser BORRADOR, PUBLICADO o ARCHIVADO.' })
  estado?: string;

  @IsOptional()
  @IsString()
  imagen_portada?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  descripcion_corta?: string;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  nota_aprobacion?: number;

  @IsOptional()
  orden_estricto?: boolean;

  @IsOptional()
  emite_certificado?: boolean;

  @IsOptional()
  duracion_horas?: number;

  @IsOptional()
  @IsString()
  fecha_inicio?: string;

  @IsOptional()
  @IsString()
  fecha_fin?: string;

  @IsOptional()
  max_estudiantes?: number;

  @IsOptional()
  @IsString()
  codigo_acceso?: string;

  @IsOptional()
  @IsString()
  escala?: string;
}

export class CreateModuloDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsOptional()
  orden?: number;
}

export class UpdateModuloDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;
}
