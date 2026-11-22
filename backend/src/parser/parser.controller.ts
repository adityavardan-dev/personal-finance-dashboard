/**
 * Purpose: Handles transaction text parsing and optional AI-assisted transaction segmentation.
 */
import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { readRequestTrace } from '../request-trace';
import { ParseRequestDto } from './dto/parse-request.dto';
import type { ParseBatchResultDto } from './dto/parse-batch-result.dto';
import type { ParseResultDto } from './dto/parse-result.dto';
import { IntentService } from './intent.service';
import { ParserService } from './parser.service';

@Controller('parser')
@UseGuards(JwtAuthGuard)
export class ParserController {
  private readonly logger = new Logger(ParserController.name);
  /** Creates this class and receives its required dependencies. */
  constructor(
    private readonly parserService: ParserService,
    private readonly intentService: IntentService,
  ) {}

  /** Handles parse. */
  @Post('parse')
  parse(
    @Body() request: ParseRequestDto,
    @Headers('x-conversation-id') conversationId?: string,
    @Headers('x-request-id') requestId?: string,
  ): ParseResultDto {
    const trace = readRequestTrace(conversationId, requestId);
    const result = this.parserService.parse(
      request.text,
      request.referenceTimestamp
        ? new Date(request.referenceTimestamp)
        : new Date(),
      request.timeZone,
    );
    this.logger.log(
      JSON.stringify({ ...trace, route: 'parse', status: result.status }),
    );
    return { ...result, ...trace };
  }

  /** Handles parse batch. */
  @Post('parse-batch')
  async parseBatch(
    @Body() request: ParseRequestDto,
    @Headers('x-conversation-id') conversationId?: string,
    @Headers('x-request-id') requestId?: string,
  ): Promise<ParseBatchResultDto> {
    const trace = readRequestTrace(conversationId, requestId);
    const result = await this.intentService.analyze(
      request.text,
      request.referenceTimestamp
        ? new Date(request.referenceTimestamp)
        : new Date(),
      request.timeZone,
      trace,
    );
    return { ...result, ...trace };
  }
}
