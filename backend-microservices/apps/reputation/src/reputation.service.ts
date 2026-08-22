import { Injectable } from '@nestjs/common';

@Injectable()
export class ReputationService {
  getHello(): string {
    return 'Hello World!';
  }
}
