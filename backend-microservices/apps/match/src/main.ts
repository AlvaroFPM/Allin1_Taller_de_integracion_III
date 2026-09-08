import { NestFactory } from '@nestjs/core';
import { MatchModule } from './match.module';
import { PrismaExceptionFilter } from '@app/shared';


async function bootstrap() {
  const app = await NestFactory.create(MatchModule);
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(process.env.port ?? 3000);
  
}
bootstrap().catch(console.error);
