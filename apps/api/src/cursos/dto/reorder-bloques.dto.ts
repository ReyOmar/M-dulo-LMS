import { IsArray, IsString } from 'class-validator';

export class ReorderBloquesDto {
  @IsArray()
  @IsString({ each: true })
  recursos_guids: string[];
}
