import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio.' })
  apellido: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  email: string;

  @IsOptional()
  @IsString()
  contrasena_actual?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres.' })
  nueva_contrasena?: string;
}
