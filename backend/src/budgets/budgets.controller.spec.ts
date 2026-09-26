import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { CurrencyCode } from './currency-code';

describe('BudgetsController', () => {
  let controller: BudgetsController;
  let service: { getMine: jest.Mock; upsert: jest.Mock };

  beforeEach(async () => {
    service = { getMine: jest.fn(), upsert: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [BudgetsController],
      providers: [{ provide: BudgetsService, useValue: service }],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true }).compile();
    controller = module.get(BudgetsController);
  });

  it('gets the budget using JWT user identity', () => {
    controller.getMine({ user: { userId: 42 } } as any);
    expect(service.getMine).toHaveBeenCalledWith(42);
  });

  it('upserts the budget using JWT user identity', () => {
    const dto = { monthlyLimit: 1000, categoryLimits: [], currency: CurrencyCode.INR };
    controller.upsert({ user: { userId: 42 } } as any, dto);
    expect(service.upsert).toHaveBeenCalledWith(42, dto);
  });

  it('is protected at controller level', () => {
    const guards: any[] = Reflect.getMetadata('__guards__', BudgetsController) ?? [];
    expect(guards).toContain(JwtAuthGuard);
  });
});
