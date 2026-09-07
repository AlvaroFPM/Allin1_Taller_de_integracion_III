import { NestFactory } from '@nestjs/core';
import { ChatModule } from './chat.module';
import { PrismaExceptionFilter } from '@app/shared';

async function bootstrap() {
  const app = await NestFactory.create(ChatModule);
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(process.env.PORT ?? 3005);
}
bootstrap().catch(console.error);
