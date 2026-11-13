import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ExpensesModule } from './expenses/expenses.module';
import { BudgetsModule } from './budgets/budgets.module';
import { ParserModule } from './parser/parser.module';
import { PeerSplitsModule } from './peer-splits/peer-splits.module';

@Module({
  imports: [
    AuthModule,
    ExpensesModule,
    BudgetsModule,
    ParserModule,
    PeerSplitsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
