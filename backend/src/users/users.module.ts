import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets/budgets.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [BudgetsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
