import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client-iam';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      // Consulta real de prueba al motor
      await this.$queryRaw`SELECT 1`;
      this.logger.log('✅ Conexión exitosa y verificada contra PostgreSQL (iam_db)');
    } catch (error) {
      this.logger.error('❌ Error al conectar con PostgreSQL:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}