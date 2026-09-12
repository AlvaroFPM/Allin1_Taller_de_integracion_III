import { NestFactory } from '@nestjs/core';
import { ReputationModule } from './reputation.module';
import { PrismaExceptionFilter } from '@app/shared';

async function bootstrap() {
  const app = await NestFactory.create(ReputationModule);
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(process.env.port ?? 3000);
}
bootstrap().catch(console.error);
