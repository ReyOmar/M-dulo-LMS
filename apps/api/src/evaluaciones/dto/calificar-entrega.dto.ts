import { IsNumber, IsOptional, IsString, Min, Max, MaxLength } from 'class-validator';

export class CalificarEntregaDto {
  @IsNumber()
  @Min(0, { message: 'La calificación mínima es 0.' })
  @Max(5, { message: 'La calificación máxima es 5.' })
  calificacion: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'El comentario no puede exceder 1000 caracteres.' })
  comentario?: string;
}
