import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  asunto?: string;

  @IsOptional()
  @IsString()
  cuerpo_html?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
