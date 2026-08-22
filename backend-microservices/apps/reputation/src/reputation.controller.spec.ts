import { Test, TestingModule } from '@nestjs/testing';
import { ReputationController } from './reputation.controller';
import { ReputationService } from './reputation.service';

describe('ReputationController', () => {
  let reputationController: ReputationController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ReputationController],
      providers: [ReputationService],
    }).compile();

    reputationController = app.get<ReputationController>(ReputationController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(reputationController.getHello()).toBe('Hello World!');
    });
  });
});
