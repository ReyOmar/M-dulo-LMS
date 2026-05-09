import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { lms_rol_usuario } from '@prisma/client';

export class SolicitarAccesoDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio.' })
  @MaxLength(100)
  apellido: string;

  @IsEnum(lms_rol_usuario, { message: 'Rol no válido.' })
  rol_pedido: lms_rol_usuario;
}
