import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetupPasswordDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña temporal es requerida para verificar identidad.' })
  contrasenaTemporal: string;

  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es requerida.' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  nuevaContrasena: string;
}
