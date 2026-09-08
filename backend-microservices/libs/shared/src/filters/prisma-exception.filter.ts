// libs/shared/src/filters/prisma-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

interface PrismaErrorLike {
  code: string;
  meta?: Record<string, unknown>;
  message: string;
}

function isPrismaKnownError(error: unknown): error is PrismaErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    (error as Record<string, unknown>).code!.toString().startsWith('P')
  );
}

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (!isPrismaKnownError(exception)) {
      throw exception;
    }

    switch (exception.code) {
      case 'P2002':
        return response.status(HttpStatus.CONFLICT).json({
          success: false,
          statusCode: HttpStatus.CONFLICT,
          message: `El registro ya existe (campo duplicado: ${JSON.stringify(exception.meta?.target)}).`,
        });
      case 'P2025':
        return response.status(HttpStatus.NOT_FOUND).json({
          success: false,
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Registro no encontrado.',
        });
      case 'P2003':
        return response.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Referencia inválida: el registro relacionado no existe.',
        });
      default:
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error de base de datos.',
        });
    }
  }
}