import { Controller, Get } from '@nestjs/common';
import { NotifyService } from './notify.service';

@Controller()
export class NotifyController {
  constructor(private readonly notifyService: NotifyService) {}

  @Get()
  getHello(): string {
    return this.notifyService.getHello();
  }
}
