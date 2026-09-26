import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CurrencyCode } from '../currency-code';
import { UpsertBudgetDto } from './upsert-budget.dto';

const valid = { monthlyLimit: 30000, categoryLimits: [{ category: 'Food', limit: 5000 }], currency: CurrencyCode.INR };

describe('UpsertBudgetDto', () => {
  it('accepts a valid budget and a null cleared budget', async () => {
    await expect(validate(plainToInstance(UpsertBudgetDto, valid))).resolves.toHaveLength(0);
    await expect(validate(plainToInstance(UpsertBudgetDto, { ...valid, monthlyLimit: null, categoryLimits: [] }))).resolves.toHaveLength(0);
  });

  it.each([0, -1])('rejects non-positive monthly limit %s', async (monthlyLimit) => {
    const errors = await validate(plainToInstance(UpsertBudgetDto, { ...valid, monthlyLimit }));
    expect(errors.some((error) => error.property === 'monthlyLimit')).toBe(true);
  });

  it('rejects invalid nested limits and unsupported currency', async () => {
    const errors = await validate(plainToInstance(UpsertBudgetDto, {
      ...valid,
      categoryLimits: [{ category: '', limit: 0 }],
      currency: 'GBP',
    }));
    expect(errors.some((error) => error.property === 'categoryLimits')).toBe(true);
    expect(errors.some((error) => error.property === 'currency')).toBe(true);
  });
});
