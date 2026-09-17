jest.mock('fs');

import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import { ExpensesService } from './expenses.service';

const mockedFs = jest.mocked(fs);

describe('ExpensesService', () => {
  let service: ExpensesService;

  const USER_A = 1;
  const USER_B = 2;

  const storedExpenses = [
    {
      id: 'uuid-a1',
      userId: USER_A,
      amount: 500,
      category: 'Food & Dining',
      merchant: 'Swiggy',
      date: '2026-09-17',
      createdAt: '2026-09-17T10:00:00.000Z',
    },
    {
      id: 'uuid-b1',
      userId: USER_B,
      amount: 1200,
      category: 'Shopping',
      merchant: 'Amazon',
      date: '2026-09-17',
      createdAt: '2026-09-17T11:00:00.000Z',
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    mockedFs.existsSync.mockReturnValue(true);
    (mockedFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(storedExpenses));
    mockedFs.writeFileSync.mockImplementation(() => undefined);
    (mockedFs.mkdirSync as jest.Mock).mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ExpensesService],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  describe('create', () => {
    it('persists a new expense and returns it with an id', () => {
      (mockedFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));
      const dto = { amount: 750, category: 'Transport', merchant: 'Ola', date: '2026-09-17' };

      const result = service.create(USER_A, dto as any);

      expect(result.id).toBeDefined();
      expect(result.userId).toBe(USER_A);
      expect(result.amount).toBe(750);
      expect(result.merchant).toBe('Ola');
      expect(result.createdAt).toBeDefined();
      expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it('appends to existing expenses without overwriting others', () => {
      const written: any[] = [];
      mockedFs.writeFileSync.mockImplementation((_path, data) => {
        written.push(JSON.parse(data as string));
      });
      const dto = { amount: 200, category: 'Utilities', merchant: 'BESCOM', date: '2026-09-17' };

      service.create(USER_A, dto as any);

      expect(written[0]).toHaveLength(storedExpenses.length + 1);
    });

    it('stores optional note when provided', () => {
      (mockedFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));
      const dto = { amount: 300, category: 'Other', merchant: 'DMart', date: '2026-09-17', note: 'Weekly groceries' };

      const result = service.create(USER_A, dto as any);

      expect(result.note).toBe('Weekly groceries');
    });
  });

  describe('findByUser', () => {
    it('returns only expenses belonging to the requesting user', () => {
      const results = service.findByUser(USER_A);

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe(USER_A);
    });

    it('enforces user isolation — user A cannot see user B expenses', () => {
      const resultsA = service.findByUser(USER_A);
      const resultsB = service.findByUser(USER_B);

      expect(resultsA.every((e) => e.userId === USER_A)).toBe(true);
      expect(resultsB.every((e) => e.userId === USER_B)).toBe(true);
      expect(resultsA.some((e) => e.userId === USER_B)).toBe(false);
    });

    it('returns empty array when user has no expenses', () => {
      const results = service.findByUser(999);

      expect(results).toHaveLength(0);
    });

    it('returns empty array when data file does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const results = service.findByUser(USER_A);

      expect(results).toHaveLength(0);
    });

    it('returns empty array when data file is corrupt', () => {
      (mockedFs.readFileSync as jest.Mock).mockReturnValue('not-valid-json');

      const results = service.findByUser(USER_A);

      expect(results).toHaveLength(0);
    });
  });
});
