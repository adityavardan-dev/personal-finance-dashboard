import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateExpenseDto {
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
