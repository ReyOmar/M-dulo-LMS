import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateConfiguracionDto {
  @IsOptional()
  @IsString()
  nombre_plataforma?: string;

  @IsOptional()
  @IsString()
  mensaje_bienvenida?: string;

  @IsOptional()
  @IsString()
  login_fondo_url?: string;

  @IsOptional()
  @IsString()
  color_primario?: string;

  @IsOptional()
  @IsString()
  color_secundario?: string;

  @IsOptional()
  @IsString()
  contrasena_defecto?: string;

  @IsOptional()
  @IsString()
  logo_url?: string;

  @IsOptional()
  @IsString()
  favicon_url?: string;

  @IsOptional()
  @IsString()
  fuente?: string;

  @IsOptional()
  @IsNumber()
  border_radius?: number;
}
