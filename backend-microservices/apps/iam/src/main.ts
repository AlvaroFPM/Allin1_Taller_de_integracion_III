import { NestFactory } from '@nestjs/core';
import { IamModule } from './iam.module';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from '@app/shared';

async function bootstrap() {
  const app = await NestFactory.create(IamModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Descarta campos sobrantes en silencio
      transform: true, // Convierte query params a los tipos del DTO
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(3000);
}
bootstrap().catch(console.error);
