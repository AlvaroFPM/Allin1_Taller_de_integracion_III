import { NestFactory } from '@nestjs/core';
import { CatalogModule } from './catalog.module';
import { AllExceptionsFilter } from '@app/shared';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(CatalogModule);
  const logger = new Logger('CatalogBootstrap');

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.CATALOG_PORT ?? 3002;
  await app.listen(port);
  logger.log(`Catalog microservice corriendo en http://localhost:${port}`);
}
bootstrap().catch(console.error);