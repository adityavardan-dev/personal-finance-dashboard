import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsPositive, ValidateIf, ValidateNested } from 'class-validator';
import { CurrencyCode } from '../currency-code';
import { CategoryBudgetLimitDto } from './category-budget-limit.dto';

export class UpsertBudgetDto {
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @IsPositive()
  monthlyLimit!: number | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryBudgetLimitDto)
  categoryLimits!: CategoryBudgetLimitDto[];

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;
}
