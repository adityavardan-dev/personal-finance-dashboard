jest.mock('fs');

import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { BudgetsService } from './budgets.service';
import { CurrencyCode } from './currency-code';

const mockedFs = jest.mocked(fs);
const payload = {
  monthlyLimit: 30000,
  categoryLimits: [{ category: 'Food & Dining', limit: 8000 }],
  currency: CurrencyCode.INR,
};

describe('BudgetsService', () => {
  let service: BudgetsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BudgetsService();
    mockedFs.existsSync.mockReturnValue(false);
    (mockedFs.readFileSync as jest.Mock).mockReturnValue('[]');
    mockedFs.writeFileSync.mockImplementation(() => undefined);
    (mockedFs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
  });

  it('returns the canonical default for a missing store', () => {
    expect(service.getMine(1)).toEqual({
      monthlyLimit: null,
      categoryLimits: [],
      currency: CurrencyCode.INR,
      createdAt: null,
      updatedAt: null,
    });
  });

  it('creates and persists an isolated user budget', () => {
    const result = service.upsert(7, payload);
    const written = JSON.parse((mockedFs.writeFileSync as jest.Mock).mock.calls[0][1]);

    expect(result.monthlyLimit).toBe(30000);
    expect(result.categoryLimits).toEqual(payload.categoryLimits);
    expect(written[0].userId).toBe(7);
    expect(result.createdAt).toBeTruthy();
  });

  it('persists across service instances', () => {
    let persisted = '[]';
    mockedFs.existsSync.mockReturnValue(true);
    (mockedFs.readFileSync as jest.Mock).mockImplementation(() => persisted);
    mockedFs.writeFileSync.mockImplementation((_path, data) => {
      persisted = data as string;
    });

    service.upsert(7, payload);
    const restartedService = new BudgetsService();

    expect(restartedService.getMine(7).monthlyLimit).toBe(30000);
  });

  it('returns only the requesting user budget', () => {
    mockedFs.existsSync.mockReturnValue(true);
    (mockedFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([
      { userId: 1, ...payload, createdAt: 'a', updatedAt: 'a' },
      { userId: 2, monthlyLimit: 500, categoryLimits: [], currency: CurrencyCode.USD, createdAt: 'b', updatedAt: 'b' },
    ]));

    expect(service.getMine(2).monthlyLimit).toBe(500);
    expect(service.getMine(2).currency).toBe(CurrencyCode.USD);
  });

  it('updates a record while preserving createdAt', () => {
    mockedFs.existsSync.mockReturnValue(true);
    (mockedFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([
      { userId: 1, ...payload, createdAt: 'original', updatedAt: 'old' },
    ]));

    const result = service.upsert(1, { ...payload, monthlyLimit: 40000 });
    expect(result.createdAt).toBe('original');
    expect(result.monthlyLimit).toBe(40000);
    expect(result.updatedAt).not.toBe('old');
  });

  it('recovers from malformed persisted data', () => {
    mockedFs.existsSync.mockReturnValue(true);
    (mockedFs.readFileSync as jest.Mock).mockReturnValue('{invalid');
    expect(service.getMine(1).monthlyLimit).toBeNull();
  });

  it('rejects category names that are empty after trimming', () => {
    expect(() => service.upsert(1, {
      ...payload,
      categoryLimits: [{ category: '   ', limit: 100 }],
    })).toThrow(BadRequestException);
  });

  it('rejects duplicate category names', () => {
    expect(() => service.upsert(1, {
      ...payload,
      categoryLimits: [{ category: 'Food', limit: 100 }, { category: 'Food', limit: 200 }],
    })).toThrow(BadRequestException);
  });

  it('rejects category limits when monthly budget is cleared', () => {
    expect(() => service.upsert(1, { ...payload, monthlyLimit: null })).toThrow(BadRequestException);
  });
});
