import { IsString, IsNotEmpty } from 'class-validator';

export class GenerarCertificadoDto {
  @IsString() @IsNotEmpty()
  curso_guid: string;
}
