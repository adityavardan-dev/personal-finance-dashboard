import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ParseRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;

  @IsString()
  @IsOptional()
  timeZone?: string;

  @IsDateString()
  @IsOptional()
  referenceTimestamp?: string;
}
