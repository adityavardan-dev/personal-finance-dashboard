/**
 * Purpose: Handles budget request routing, validation, and persistence.
 */
import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BudgetsService } from './budgets.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  /** Creates this class and receives its required dependencies. */
  constructor(private readonly budgetsService: BudgetsService) {}

  /** Returns get mine. */
  @Get('me')
  getMine(@Request() req: any) {
    return this.budgetsService.getMine(req.user.userId as number);
  }

  /** Handles upsert. */
  @Put('me')
  upsert(@Request() req: any, @Body() dto: UpsertBudgetDto) {
    return this.budgetsService.upsert(req.user.userId as number, dto);
  }
}
