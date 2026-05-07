import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString() @IsNotEmpty()
  token: string;

  @IsString() @MinLength(6)
  nuevaContrasena: string;
}
