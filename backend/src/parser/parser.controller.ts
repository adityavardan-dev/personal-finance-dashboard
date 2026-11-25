/**
 * Purpose: Handles transaction text parsing and optional AI-assisted transaction segmentation.
 */
import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
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
import { AiEvalCasesService } from './ai-eval-cases.service';
import { CreateAiEvalCaseDto } from './dto/create-ai-eval-case.dto';
import { AiEvalRunnerService } from './ai-eval-runner.service';

interface AuthenticatedParserRequest {
  user?: { accessToken: string };
}

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
    private readonly aiEvalCases: AiEvalCasesService,
    private readonly aiEvalRunner: AiEvalRunnerService,
  ) {}

  /** Saves a user-approved response from any Penny path as a DEV evaluation candidate. */
  @Post('eval-cases')
  createEvalCase(
    @Body() request: CreateAiEvalCaseDto,
    @Req() httpRequest: AuthenticatedParserRequest,
  ) {
    return this.aiEvalCases.create(httpRequest.user!.accessToken, request);
  }

  /** Scores stored human-reviewed cases without spending model tokens. */
  @Post('eval-runs/captured-baseline')
  runCapturedBaseline(@Req() httpRequest: AuthenticatedParserRequest) {
    return this.aiEvalRunner.runCapturedBaseline(httpRequest.user!.accessToken);
  }

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
    @Req() httpRequest?: AuthenticatedParserRequest,
  ): Promise<ParseBatchResultDto> {
    const trace = readRequestTrace(conversationId, requestId);
    const result = await this.intentService.analyze(
      request.text,
      request.referenceTimestamp
        ? new Date(request.referenceTimestamp)
        : new Date(),
      request.timeZone,
      trace,
      httpRequest?.user?.accessToken,
    );
    return { ...result, ...trace };
  }

  /** Extracts peer split amounts and group sizes for review. */
  @Post('split-intent')
  async splitIntent(
    @Body() request: ParseRequestDto,
    @Headers('x-conversation-id') conversationId?: string,
    @Headers('x-request-id') requestId?: string,
    @Req() httpRequest?: AuthenticatedParserRequest,
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
        httpRequest?.user?.accessToken,
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
    @Req() httpRequest?: AuthenticatedParserRequest,
  ) {
    const trace = readRequestTrace(conversationId, requestId);
    return {
      ...(await this.splitFollowUpService.analyze(
        request?.text,
        request?.pendingSplits,
        trace,
        httpRequest?.user?.accessToken,
      )),
      ...trace,
    };
  }

  /** Interprets edits to unsaved personal drafts supplied by the current conversation. */
  @Post('personal-follow-up')
  async personalFollowUp(
    @Body()
    request: {
      text: unknown;
      drafts: unknown;
      referenceTimestamp?: string;
      timeZone?: string;
    },
    @Headers('x-conversation-id') conversationId?: string,
    @Headers('x-request-id') requestId?: string,
    @Req() httpRequest?: AuthenticatedParserRequest,
  ) {
    const trace = readRequestTrace(conversationId, requestId);
    return {
      ...(await this.personalFollowUpService.analyze(
        request?.text,
        request?.drafts,
        trace,
        request.referenceTimestamp
          ? new Date(request.referenceTimestamp)
          : new Date(),
        request.timeZone,
        'EDIT',
        httpRequest?.user?.accessToken,
      )),
      ...trace,
    };
  }
}
