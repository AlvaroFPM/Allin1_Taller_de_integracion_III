import { Test, TestingModule } from '@nestjs/testing';
import { NotifyController } from './notify.controller';
import { NotifyService } from './notify.service';

describe('NotifyController', () => {
  let notifyController: NotifyController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [NotifyController],
      providers: [NotifyService],
    }).compile();

    notifyController = app.get<NotifyController>(NotifyController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(notifyController.getHello()).toBe('Hello World!');
    });
  });
});
