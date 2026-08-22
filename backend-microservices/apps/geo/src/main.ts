import { NestFactory } from '@nestjs/core';
import { GeoModule } from './geo.module';

async function bootstrap() {
  const app = await NestFactory.create(GeoModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
