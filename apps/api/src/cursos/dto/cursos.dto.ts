import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { IsSafeStorageKey } from '../../common/validators/safe-storage-key.validator';

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
  @IsSafeStorageKey()
  imagen_portada?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  descripcion_corta?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO', 'EXPERTO'], {
    message: 'Nivel debe ser PRINCIPIANTE, INTERMEDIO, AVANZADO o EXPERTO.',
  })
  nivel?: string;

  @IsOptional()
  @IsNumber({}, { message: 'nota_aprobacion debe ser un número.' })
  @Min(0, { message: 'La nota mínima de aprobación no puede ser negativa.' })
  @Max(5, { message: 'La nota máxima de aprobación no puede exceder 5.0.' })
  nota_aprobacion?: number;

  @IsOptional()
  @IsBoolean({ message: 'orden_estricto debe ser verdadero o falso.' })
  orden_estricto?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'emite_certificado debe ser verdadero o falso.' })
  emite_certificado?: boolean;

  @IsOptional()
  @IsNumber({}, { message: 'duracion_horas debe ser un número.' })
  @Min(0, { message: 'La duración no puede ser negativa.' })
  duracion_horas?: number;

  @IsOptional()
  @IsString()
  fecha_inicio?: string;

  @IsOptional()
  @IsString()
  fecha_fin?: string;

  @IsOptional()
  @IsNumber({}, { message: 'max_estudiantes debe ser un número.' })
  @Min(1, { message: 'El máximo de estudiantes debe ser al menos 1.' })
  max_estudiantes?: number;

  @IsOptional()
  @IsString()
  codigo_acceso?: string;

  @IsOptional()
  @IsString()
  @IsIn(['NUMERICA', 'PORCENTAJE', 'PUNTOS', 'LETRAS'], {
    message: 'Escala debe ser NUMERICA, PORCENTAJE, PUNTOS o LETRAS.',
  })
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
