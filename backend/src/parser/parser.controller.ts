import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParseRequestDto } from './dto/parse-request.dto';
import type { ParseBatchResultDto } from './dto/parse-batch-result.dto';
import type { ParseResultDto } from './dto/parse-result.dto';
import { ParserService } from './parser.service';

@Controller('parser')
@UseGuards(JwtAuthGuard)
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Post('parse')
  parse(@Body() request: ParseRequestDto): ParseResultDto {
    return this.parserService.parse(
      request.text,
      request.referenceTimestamp
        ? new Date(request.referenceTimestamp)
        : new Date(),
      request.timeZone,
    );
  }

  @Post('parse-batch')
  parseBatch(@Body() request: ParseRequestDto): ParseBatchResultDto {
    return this.parserService.parseBatch(
      request.text,
      request.referenceTimestamp
        ? new Date(request.referenceTimestamp)
        : new Date(),
      request.timeZone,
    );
  }
}
