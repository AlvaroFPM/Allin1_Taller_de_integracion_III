import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { RolUsuario } from '@prisma/client-iam';

export class CreateUsuarioTestDto {
  @IsString()
  @IsNotEmpty()
  rut!: string;

  @IsString()
  @IsNotEmpty()
  nombres!: string;

  @IsString()
  @IsNotEmpty()
  apellidos!: string;

  @IsEmail()
  correo!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(RolUsuario)
  @IsNotEmpty()
  rol!: RolUsuario;
}