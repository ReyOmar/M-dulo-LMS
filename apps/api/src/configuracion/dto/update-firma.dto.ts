import { IsOptional, IsString } from 'class-validator';
import { IsSafeStorageKey } from '../../common/validators/safe-storage-key.validator';

export class UpdateFirmaDto {
  @IsOptional()
  @IsString()
  @IsSafeStorageKey()
  firma_url?: string;

  @IsOptional()
  @IsString()
  firma_nombre?: string;

  @IsOptional()
  @IsString()
  firma_cargo?: string;
}
