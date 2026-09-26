import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CurrencyCode } from '../../budgets/currency-code';
import { UpdateUserPreferencesDto } from './update-user-preferences.dto';

describe('UpdateUserPreferencesDto', () => {
  it.each([CurrencyCode.INR, CurrencyCode.USD, CurrencyCode.EUR])('accepts %s', async (currency) => {
    await expect(validate(plainToInstance(UpdateUserPreferencesDto, { currency }))).resolves.toHaveLength(0);
  });

  it('rejects unsupported currency', async () => {
    const errors = await validate(plainToInstance(UpdateUserPreferencesDto, { currency: 'GBP' }));
    expect(errors.some((error) => error.property === 'currency')).toBe(true);
  });
});
