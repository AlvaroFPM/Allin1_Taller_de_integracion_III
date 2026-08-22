import { Injectable } from '@nestjs/common';

@Injectable()
export class NotifyService {
  getHello(): string {
    return 'Hello World!';
  }
}
