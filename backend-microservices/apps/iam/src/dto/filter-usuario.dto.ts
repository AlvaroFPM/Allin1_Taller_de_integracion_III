import { IsOptional, IsString, IsEnum, IsBoolean, IsDateString, IsInt, Min, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { RolUsuario } from '@prisma/client-iam';

export class FilterUsuarioDto {
  @IsOptional()
  @IsString()
  search?: string; // Búsqueda parcial en nombres, apellidos o correo

  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  estadoActivo?: boolean;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string; // Formato ISO YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['fechaCreacion', 'nombres', 'apellidos'])
  ordenarPor?: string = 'fechaCreacion';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  ordenDireccion?: 'asc' | 'desc' = 'desc';
}