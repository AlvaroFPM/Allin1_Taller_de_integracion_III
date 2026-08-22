import { Injectable } from '@nestjs/common';

@Injectable()
export class MatchService {
  getHello(): string {
    return 'Hello World!';
  }
}
