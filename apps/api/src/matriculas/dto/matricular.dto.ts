import { IsString, IsNotEmpty } from 'class-validator';

export class MatricularEstudianteDto {
  @IsString()
  @IsNotEmpty()
  usuario_guid: string;
}
