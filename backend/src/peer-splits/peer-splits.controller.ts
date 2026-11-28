/**
 * Purpose: Handles peer-split request routing and split preview calculations.
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
import { PeerSplitsService } from './peer-splits.service';

@Controller('peer-splits')
@UseGuards(JwtAuthGuard)
export class PeerSplitsController {
  private readonly logger = new Logger(PeerSplitsController.name);
  /** Creates this class and receives its required dependencies. */
  constructor(private readonly service: PeerSplitsService) {}

  /** Handles preview. */
  @Post('preview')
  preview(
    @Body() input: unknown,
    @Headers('x-conversation-id') conversationId?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const trace = readRequestTrace(conversationId, requestId);
    const result = this.service.preview(input);
    this.logger.log(JSON.stringify({ ...trace, route: 'peer-splits/preview' }));
    return { ...result, ...trace };
  }
}
