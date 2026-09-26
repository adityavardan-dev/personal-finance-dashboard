import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TransactionType } from '../transaction-type';
import { CreateExpenseDto } from './create-expense.dto';
import { UpdateExpenseDto } from './update-expense.dto';

const validCreate = {
  type: TransactionType.Expense,
  amount: 100,
  category: 'Food & Dining',
  merchant: 'Cafe',
  date: '2026-09-26',
};

describe('expense DTO transaction type validation', () => {
  it('accepts expense and income create types', async () => {
    for (const type of [TransactionType.Expense, TransactionType.Income]) {
      const errors = await validate(plainToInstance(CreateExpenseDto, { ...validCreate, type }));
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects a missing create type', async () => {
    const { type: _type, ...withoutType } = validCreate;
    const errors = await validate(plainToInstance(CreateExpenseDto, withoutType));

    expect(errors.some((error) => error.property === 'type')).toBe(true);
  });

  it('rejects an unsupported create type', async () => {
    const errors = await validate(plainToInstance(CreateExpenseDto, { ...validCreate, type: 'transfer' }));

    expect(errors.some((error) => error.property === 'type')).toBe(true);
  });

  it('allows update type to be omitted and rejects unsupported values', async () => {
    await expect(validate(plainToInstance(UpdateExpenseDto, { amount: 200 }))).resolves.toHaveLength(0);

    const errors = await validate(plainToInstance(UpdateExpenseDto, { type: 'transfer' }));
    expect(errors.some((error) => error.property === 'type')).toBe(true);
  });
});
