import { IsString, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';

export class EnviarMensajeDto {
  @IsString() @IsNotEmpty()
  destinatario_guid: string;

  @IsString() @IsNotEmpty()
  asunto: string;

  @IsString() @IsNotEmpty()
  contenido: string;

  @IsOptional() @IsString()
  ref_tipo?: string;

  @IsOptional() @IsString()
  ref_guid?: string;
}

export class SolicitarContactoDto {
  @IsString() @IsNotEmpty()
  receptor_guid: string;

  @IsString() @IsNotEmpty()
  curso_guid: string;
}

export class ResponderContactoDto {
  @IsBoolean()
  aceptar: boolean;
}
