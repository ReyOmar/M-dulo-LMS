import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class UpdateCertConfigDto {
  @IsOptional() @IsString()
  cert_titulo_personalizado?: string;

  @IsOptional() @IsString()
  cert_subtitulo?: string;

  @IsOptional() @IsString()
  cert_texto_legal?: string;

  @IsOptional() @IsBoolean()
  cert_mostrar_modulos?: boolean;

  @IsOptional() @IsBoolean()
  cert_mostrar_recursos?: boolean;

  @IsOptional() @IsBoolean()
  cert_mostrar_nota?: boolean;

  @IsOptional() @IsBoolean()
  cert_mostrar_firma?: boolean;

  @IsOptional() @IsBoolean()
  cert_mostrar_fecha_ingreso?: boolean;
}
