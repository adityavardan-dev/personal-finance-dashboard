import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BudgetsService } from './budgets.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get('me')
  getMine(@Request() req: any) {
    return this.budgetsService.getMine(req.user.userId as number);
  }

  @Put('me')
  upsert(@Request() req: any, @Body() dto: UpsertBudgetDto) {
    return this.budgetsService.upsert(req.user.userId as number, dto);
  }
}
