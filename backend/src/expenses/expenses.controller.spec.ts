/**
 * Purpose: Tests the behavior of the related backend feature.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

describe('ExpensesController', () => {
  let controller: ExpensesController;
  let service: jest.Mocked<ExpensesService>;

  const mockRequest = { user: { userId: 'user-1', email: 'admin@test.com', accessToken: 'token-1' } };

  const mockExpense = {
    id: 'uuid-1',
    userId: 'user-1',
    type: 'expense',
    amount: 500,
    currency: 'INR',
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
            createBatch: jest.fn().mockReturnValue([mockExpense]),
            findByUser: jest.fn().mockReturnValue([mockExpense]),
            findOne: jest.fn().mockReturnValue(mockExpense),
            update: jest.fn().mockReturnValue(mockExpense),
            remove: jest.fn().mockReturnValue(mockExpense),
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
    it('creates an expense for the authenticated user' /** Checks that creates an expense for the authenticated user. */, () => {
      const dto = {
        type: 'expense',
        amount: 500,
        category: 'Food & Dining',
        merchant: 'Swiggy',
        date: '2026-09-17',
      };

      const result = controller.create(mockRequest as any, dto as any);

      expect(result).toEqual(mockExpense);
      expect(service.create).toHaveBeenCalledWith('user-1', 'token-1', dto);
    });

    it('passes the userId from the JWT token — not from the request body' /** Checks that passes the userId from the JWT token — not from the request body. */, () => {
      const dto = {
        type: 'expense',
        amount: 200,
        category: 'Transport',
        merchant: 'Uber',
        date: '2026-09-17',
      };
      const reqWithDifferentUser = {
        user: { userId: 'user-42', email: 'other@test.com', accessToken: 'token-42' },
      };

      controller.create(reqWithDifferentUser as any, dto as any);

      expect(service.create).toHaveBeenCalledWith('user-42', 'token-42', dto);
    });
  });

  describe('POST /expenses/batch', () => {
    it('creates all transactions for the authenticated user' /** Checks that creates all transactions for the authenticated user. */, () => {
      const transactions = [
        {
          type: 'expense',
          amount: 500,
          category: 'Transport',
          merchant: 'Ola',
          date: '2026-11-10',
        },
      ];

      expect(
        controller.createBatch(mockRequest as any, { transactions } as any),
      ).toEqual([mockExpense]);
      expect(service.createBatch).toHaveBeenCalledWith('user-1', 'token-1', transactions);
    });
  });

  describe('GET /expenses', () => {
    it('returns expenses for the authenticated user' /** Checks that returns expenses for the authenticated user. */, () => {
      const result = controller.findAll(mockRequest as any);

      expect(result).toEqual([mockExpense]);
      expect(service.findByUser).toHaveBeenCalledWith('user-1', 'token-1');
    });
  });

  describe('GET /expenses/:id', () => {
    it('returns the expense by ID for the authenticated user' /** Checks that returns the expense by ID for the authenticated user. */, () => {
      const result = controller.findOne(mockRequest as any, 'uuid-1');

      expect(result).toEqual(mockExpense);
      expect(service.findOne).toHaveBeenCalledWith('user-1', 'token-1', 'uuid-1');
    });

    it('passes the userId from the JWT token' /** Checks that passes the userId from the JWT token. */, () => {
      controller.findOne({ user: { userId: 'user-42', accessToken: 'token-42' } } as any, 'uuid-1');

      expect(service.findOne).toHaveBeenCalledWith('user-42', 'token-42', 'uuid-1');
    });
  });

  describe('PATCH /expenses/:id', () => {
    it('calls service.update with authenticated userId and returns result' /** Checks that calls service.update with authenticated userId and returns result. */, () => {
      const dto = { amount: 999, merchant: 'Updated' };
      const result = controller.update(
        mockRequest as any,
        'uuid-1',
        dto as any,
      );

      expect(result).toEqual(mockExpense);
      expect(service.update).toHaveBeenCalledWith('user-1', 'token-1', 'uuid-1', dto);
    });

    it('passes the userId from the JWT token — not the body' /** Checks that passes the userId from the JWT token — not the body. */, () => {
      controller.update({ user: { userId: 'user-7', accessToken: 'token-7' } } as any, 'uuid-1', {} as any);

      expect(service.update).toHaveBeenCalledWith('user-7', 'token-7', 'uuid-1', {});
    });
  });

  describe('DELETE /expenses/:id', () => {
    it('calls service.remove with authenticated userId and returns result' /** Checks that calls service.remove with authenticated userId and returns result. */, () => {
      const result = controller.remove(mockRequest as any, 'uuid-1');

      expect(result).toEqual(mockExpense);
      expect(service.remove).toHaveBeenCalledWith('user-1', 'token-1', 'uuid-1');
    });

    it('passes the userId from the JWT token' /** Checks that passes the userId from the JWT token. */, () => {
      controller.remove({ user: { userId: 'user-5', accessToken: 'token-5' } } as any, 'uuid-1');

      expect(service.remove).toHaveBeenCalledWith('user-5', 'token-5', 'uuid-1');
    });
  });

  describe('guard coverage', () => {
    it('JwtAuthGuard is applied at the controller level' /** Checks that JwtAuthGuard is applied at the controller level. */, () => {
      const guards: any[] =
        Reflect.getMetadata('__guards__', ExpensesController) ?? [];
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
