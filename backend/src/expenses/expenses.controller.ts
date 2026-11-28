/**
 * Purpose: Handles expense request routing, validation, and persistence.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateExpensesBatchDto } from './dto/create-expenses-batch.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

interface AuthenticatedRequest {
  user: { userId: string; accessToken: string };
}

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  /** Creates this class and receives its required dependencies. */
  constructor(private readonly expensesService: ExpensesService) {}

  /** Handles create. */
  @Post()
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(req.user.userId, req.user.accessToken, dto);
  }

  /** Handles create batch. */
  @Post('batch')
  createBatch(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateExpensesBatchDto,
  ) {
    return this.expensesService.createBatch(req.user.userId, req.user.accessToken, dto.transactions);
  }

  /** Returns find all. */
  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.expensesService.findByUser(req.user.userId, req.user.accessToken);
  }

  /** Returns find one. */
  @Get(':id')
  findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.expensesService.findOne(req.user.userId, req.user.accessToken, id);
  }

  /** Handles update. */
  @Patch(':id')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(req.user.userId, req.user.accessToken, id, dto);
  }

  /** Handles remove. */
  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.expensesService.remove(req.user.userId, req.user.accessToken, id);
  }
}
