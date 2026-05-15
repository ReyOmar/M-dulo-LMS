import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, MaxLength } from 'class-validator';
import { lms_tipo_recurso } from '@prisma/client';
import { IsSafeStorageKey } from '../../common/validators/safe-storage-key.validator';

export class CreateBloqueDto {
  @IsEnum(lms_tipo_recurso)
  @IsNotEmpty()
  tipo: lms_tipo_recurso;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000, { message: 'El contenido HTML no puede exceder 100KB.' })
  contenido_html?: string;
}

export class UpdateBloqueDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000, { message: 'El contenido HTML no puede exceder 100KB.' })
  contenido_html?: string;

  @IsOptional()
  @IsString()
  @IsSafeStorageKey()
  url_archivo?: string;

  @IsOptional()
  @IsString()
  url_referencia?: string;

  @IsOptional()
  @IsString()
  @IsSafeStorageKey()
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
