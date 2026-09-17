import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

describe('ExpensesController', () => {
  let controller: ExpensesController;
  let service: jest.Mocked<ExpensesService>;

  const mockRequest = { user: { userId: 1, email: 'admin@test.com' } };

  const mockExpense = {
    id: 'uuid-1',
    userId: 1,
    amount: 500,
    category: 'Food & Dining',
    merchant: 'Swiggy',
    date: '2026-09-17',
    createdAt: '2026-09-17T10:00:00.000Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [
        {
          provide: ExpensesService,
          useValue: {
            create: jest.fn().mockReturnValue(mockExpense),
            findByUser: jest.fn().mockReturnValue([mockExpense]),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExpensesController>(ExpensesController);
    service = module.get(ExpensesService);
  });

  describe('POST /expenses', () => {
    it('creates an expense for the authenticated user', () => {
      const dto = { amount: 500, category: 'Food & Dining', merchant: 'Swiggy', date: '2026-09-17' };

      const result = controller.create(mockRequest as any, dto as any);

      expect(result).toEqual(mockExpense);
      expect(service.create).toHaveBeenCalledWith(1, dto);
    });

    it('passes the userId from the JWT token — not from the request body', () => {
      const dto = { amount: 200, category: 'Transport', merchant: 'Uber', date: '2026-09-17' };
      const reqWithDifferentUser = { user: { userId: 42, email: 'other@test.com' } };

      controller.create(reqWithDifferentUser as any, dto as any);

      expect(service.create).toHaveBeenCalledWith(42, dto);
    });
  });

  describe('GET /expenses', () => {
    it('returns expenses for the authenticated user', () => {
      const result = controller.findAll(mockRequest as any);

      expect(result).toEqual([mockExpense]);
      expect(service.findByUser).toHaveBeenCalledWith(1);
    });
  });

  describe('guard coverage', () => {
    it('JwtAuthGuard is applied at the controller level', () => {
      const guards: any[] = Reflect.getMetadata('__guards__', ExpensesController) ?? [];
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
