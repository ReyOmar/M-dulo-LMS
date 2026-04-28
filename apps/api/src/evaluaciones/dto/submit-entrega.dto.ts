import { IsString, IsNotEmpty } from 'class-validator';

export class SubmitEntregaDto {
  @IsString()
  @IsNotEmpty()
  base64: string;

  @IsString()
  @IsNotEmpty()
  nombre_archivo: string;
}
