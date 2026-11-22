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
import { SplitIntentService } from './split-intent.service';
import { SplitFollowUpService } from './split-follow-up.service';
import { PersonalFollowUpService } from './personal-follow-up.service';

@Controller('parser')
@UseGuards(JwtAuthGuard)
export class ParserController {
  private readonly logger = new Logger(ParserController.name);
  /** Creates this class and receives its required dependencies. */
  constructor(
    private readonly parserService: ParserService,
    private readonly intentService: IntentService,
    private readonly splitIntentService: SplitIntentService,
    private readonly splitFollowUpService: SplitFollowUpService,
    private readonly personalFollowUpService: PersonalFollowUpService,
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

  /** Extracts peer split amounts and group sizes for review. */
  @Post('split-intent')
  async splitIntent(
    @Body() request: ParseRequestDto,
    @Headers('x-conversation-id') conversationId?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const trace = readRequestTrace(conversationId, requestId);
    return {
      ...(await this.splitIntentService.analyze(
        request.text,
        trace,
        request.referenceTimestamp
          ? new Date(request.referenceTimestamp)
          : new Date(),
        request.timeZone,
      )),
      ...trace,
    };
  }

  /** Interprets participant names for existing split cards in this conversation. */
  @Post('split-follow-up')
  async splitFollowUp(
    @Body() request: { text: unknown; pendingSplits: unknown },
    @Headers('x-conversation-id') conversationId?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const trace = readRequestTrace(conversationId, requestId);
    return {
      ...(await this.splitFollowUpService.analyze(request?.text, request?.pendingSplits, trace)),
      ...trace,
    };
  }

  /** Interprets edits to unsaved personal drafts supplied by the current conversation. */
  @Post('personal-follow-up')
  async personalFollowUp(
    @Body() request: { text: unknown; drafts: unknown; referenceTimestamp?: string; timeZone?: string },
    @Headers('x-conversation-id') conversationId?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const trace = readRequestTrace(conversationId, requestId);
    return {
      ...(await this.personalFollowUpService.analyze(request?.text, request?.drafts, trace,
        request.referenceTimestamp ? new Date(request.referenceTimestamp) : new Date(), request.timeZone)),
      ...trace,
    };
  }
}
