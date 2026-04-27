import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { lms_rol_usuario } from '@prisma/client';

export class SolicitarAccesoDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio.' })
  apellido: string;

  @IsEnum(lms_rol_usuario, { message: 'Rol no válido.' })
  rol_pedido: lms_rol_usuario;
}
