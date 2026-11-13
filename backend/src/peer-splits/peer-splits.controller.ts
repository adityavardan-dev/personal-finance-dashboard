import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PeerSplitsService } from './peer-splits.service';

@Controller('peer-splits')
@UseGuards(JwtAuthGuard)
export class PeerSplitsController {
  constructor(private readonly service: PeerSplitsService) {}

  @Post('preview')
  preview(@Body() input: unknown) {
    return this.service.preview(input);
  }
}
