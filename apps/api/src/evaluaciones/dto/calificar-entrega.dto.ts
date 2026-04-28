import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CalificarEntregaDto {
  @IsNumber()
  calificacion: number;

  @IsOptional()
  @IsString()
  comentario?: string;
}
