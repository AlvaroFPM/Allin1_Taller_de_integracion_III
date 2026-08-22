import { NestFactory } from '@nestjs/core';
import { ReputationModule } from './reputation.module';

async function bootstrap() {
  const app = await NestFactory.create(ReputationModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
