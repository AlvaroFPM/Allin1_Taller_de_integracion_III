import { Test, TestingModule } from '@nestjs/testing';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';

describe('MatchController', () => {
  let matchController: MatchController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MatchController],
      providers: [MatchService],
    }).compile();

    matchController = app.get<MatchController>(MatchController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(matchController.getHello()).toBe('Hello World!');
    });
  });
});
