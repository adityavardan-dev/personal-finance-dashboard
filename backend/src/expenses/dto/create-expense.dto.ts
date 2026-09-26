import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { TransactionType } from '../transaction-type';

export class CreateExpenseDto {
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsString()
  @MinLength(1)
  merchant!: string;

  @IsDateString()
  date!: string;

  @IsString()
  @IsOptional()
  note?: string;
}
