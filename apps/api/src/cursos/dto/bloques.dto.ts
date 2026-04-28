import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { lms_tipo_recurso } from '@prisma/client';

export class CreateBloqueDto {
  @IsEnum(lms_tipo_recurso)
  @IsNotEmpty()
  tipo: lms_tipo_recurso;

  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  contenido_html?: string;
}

export class UpdateBloqueDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  contenido_html?: string;

  @IsOptional()
  @IsString()
  url_archivo?: string;

  @IsOptional()
  @IsString()
  url_referencia?: string;

  @IsOptional()
  @IsString()
  archivo_adjunto?: string;

  @IsOptional()
  @IsString()
  archivo_adjunto_nombre?: string;

  @IsOptional()
  @IsString()
  quiz_config?: string;

  @IsOptional()
  @IsNumber()
  archivo_max_size_mb?: number;
}
