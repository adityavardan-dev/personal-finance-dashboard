/**
 * Purpose: Defines and validates the data shape accepted or returned by this backend feature.
 */
import { IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class CategoryBudgetLimitDto {
  @IsString()
  @MinLength(1)
  category!: string;

  @IsNumber()
  @IsPositive()
  limit!: number;
}
