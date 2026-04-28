import { IsString, IsNotEmpty } from 'class-validator';

export class MarcarRecursoDto {
  @IsString()
  @IsNotEmpty()
  recurso_guid: string;
}
