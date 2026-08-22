import { NestFactory } from '@nestjs/core';
import { NotifyModule } from './notify.module';

async function bootstrap() {
  const app = await NestFactory.create(NotifyModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
