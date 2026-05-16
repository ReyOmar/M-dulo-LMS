import { IsOptional, IsString, IsNumber, Matches, Max, Min } from 'class-validator';
import { IsSafeStorageKey } from '../../common/validators/safe-storage-key.validator';

export class UpdateConfiguracionDto {
  @IsOptional()
  @IsString()
  nombre_plataforma?: string;

  @IsOptional()
  @IsString()
  mensaje_bienvenida?: string;

  @IsOptional()
  @IsString()
  @IsSafeStorageKey()
  login_fondo_url?: string | null;

  // F1.6: Validate hex color format to prevent XSS via style injection
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, {
    message: 'color_primario debe ser un color hexadecimal válido (ej: #4f46e5)',
  })
  color_primario?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, {
    message: 'color_secundario debe ser un color hexadecimal válido (ej: #10b981)',
  })
  color_secundario?: string;

  // F1.2: contrasena_defecto removed — field is deprecated (passwordless onboarding)

  @IsOptional()
  @IsString()
  @IsSafeStorageKey()
  logo_url?: string | null;

  @IsOptional()
  @IsString()
  @IsSafeStorageKey()
  favicon_url?: string | null;

  @IsOptional()
  @IsString()
  fuente?: string;

  // F1.6: Limit border_radius to prevent layout-breaking values
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
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
