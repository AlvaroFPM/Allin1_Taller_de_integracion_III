import { NestFactory } from '@nestjs/core';
import { CatalogModule } from './catalog.module';
import { AllExceptionsFilter } from '@app/shared';

async function bootstrap() {
  const app = await NestFactory.create(CatalogModule);

  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.port ?? 3002);
}
bootstrap().catch(console.error);