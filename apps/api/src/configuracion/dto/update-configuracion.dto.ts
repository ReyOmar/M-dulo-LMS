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
  login_fondo_url?: string | null;

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
  logo_url?: string | null;

  @IsOptional()
  @IsString()
  favicon_url?: string | null;

  @IsOptional()
  @IsString()
  fuente?: string;

  @IsOptional()
  @IsNumber()
  border_radius?: number;

  // Landing Page - Hero
  @IsOptional()
  @IsString()
  landing_hero_titulo1?: string;

  @IsOptional()
  @IsString()
  landing_hero_titulo2?: string;

  @IsOptional()
  @IsString()
  landing_hero_subtitulo?: string;

  // Landing Page - Contacto
  @IsOptional()
  @IsString()
  landing_telefono?: string;

  @IsOptional()
  @IsString()
  landing_telefono_sub?: string;

  @IsOptional()
  @IsString()
  landing_email?: string;

  @IsOptional()
  @IsString()
  landing_email_sub?: string;

  @IsOptional()
  @IsString()
  landing_oficina?: string;

  @IsOptional()
  @IsString()
  landing_oficina_sub?: string;

  // Landing Page - Footer
  @IsOptional()
  @IsString()
  landing_footer_texto?: string;

  // Legal
  @IsOptional()
  @IsString()
  legal_terminos?: string;

  @IsOptional()
  @IsString()
  legal_privacidad?: string;

  @IsOptional()
  @IsString()
  legal_datos?: string;
}
