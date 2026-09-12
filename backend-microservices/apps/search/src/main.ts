import { NestFactory } from '@nestjs/core';
import { SearchModule } from './search.module';
import { PrismaExceptionFilter } from '@app/shared';

async function bootstrap() {
  const app = await NestFactory.create(SearchModule);
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(process.env.port ?? 3000);
}
bootstrap().catch(console.error);
