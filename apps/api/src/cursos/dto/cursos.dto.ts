import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCursoDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsOptional()
  @IsString()
  profesor_guid?: string;
}

export class AsignarCursoDto {
  @IsString()
  @IsNotEmpty()
  profesor_guid: string;
}

export class UpdateCursoDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsNotEmpty()
  estado: string;
}

export class CreateModuloDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsOptional()
  orden?: number;
}

export class UpdateModuloDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;
}
