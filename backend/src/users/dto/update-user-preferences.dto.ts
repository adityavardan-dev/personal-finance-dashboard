import { IsEnum } from 'class-validator';
import { CurrencyCode } from '../../budgets/currency-code';

export class UpdateUserPreferencesDto {
  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;
}
