import { IsOptional, IsString } from 'class-validator';

export class UpdateFirmaDto {
  @IsOptional() @IsString()
  firma_url?: string;

  @IsOptional() @IsString()
  firma_nombre?: string;

  @IsOptional() @IsString()
  firma_cargo?: string;
}
