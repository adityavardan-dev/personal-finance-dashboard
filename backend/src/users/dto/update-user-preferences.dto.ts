/**
 * Purpose: Defines and validates the data shape accepted or returned by this backend feature.
 */
import { IsEnum } from 'class-validator';
import { CurrencyCode } from '../../budgets/currency-code';

export class UpdateUserPreferencesDto {
  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;
}
