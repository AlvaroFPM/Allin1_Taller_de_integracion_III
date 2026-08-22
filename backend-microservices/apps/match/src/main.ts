import { NestFactory } from '@nestjs/core';
import { MatchModule } from './match.module';

async function bootstrap() {
  const app = await NestFactory.create(MatchModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
