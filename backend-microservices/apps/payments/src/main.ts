import { NestFactory } from '@nestjs/core';
import { PaymentsModule } from './payments.module';
import { PrismaExceptionFilter } from '@app/shared';

async function bootstrap() {
  const app = await NestFactory.create(PaymentsModule);
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(process.env.port ?? 3000);
}
bootstrap().catch(console.error);
