import { Controller, Get } from '@nestjs/common';
import { ReputationService } from './reputation.service';

@Controller()
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get()
  getHello(): string {
    return this.reputationService.getHello();
  }
}
