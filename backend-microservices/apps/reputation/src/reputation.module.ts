import { Module } from '@nestjs/common';
import { ReputationController } from './reputation.controller';
import { ReputationService } from './reputation.service';

@Module({
  imports: [],
  controllers: [ReputationController],
  providers: [ReputationService],
})
export class ReputationModule {}
