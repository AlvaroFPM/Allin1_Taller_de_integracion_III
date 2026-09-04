// backend-microservices/apps/iam/src/iam.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class IamService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async testDatabaseConnection() {
    // Consulta real sobre la tabla de usuarios migrada
    const totalUsuarios = await this.prisma.usuario.count();
    return {
      status: 'success',
      message: 'Conexión verificada con la base de datos PostgreSQL de IAM',
      registrosEnBaseDeDatos: totalUsuarios,
      timestamp: new Date().toISOString(),
    };
  }
}