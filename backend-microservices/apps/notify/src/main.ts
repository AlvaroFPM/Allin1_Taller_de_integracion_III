import { NestFactory } from '@nestjs/core';
import { NotifyModule } from './notify.module';
import { PrismaExceptionFilter } from '@app/shared';

async function bootstrap() {
  const app = await NestFactory.create(NotifyModule);
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(process.env.port ?? 3000);
}
bootstrap().catch(console.error);
