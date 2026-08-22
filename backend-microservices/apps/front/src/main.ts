import { NestFactory } from '@nestjs/core';
import { FrontModule } from './front.module';

async function bootstrap() {
  const app = await NestFactory.create(FrontModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
