import { Module } from '@nestjs/common';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [],
  controllers: [IamController],
  providers: [IamService, PrismaService],
})
export class IamModule {}