/**
 * Purpose: Connects the feature modules that make up the NestJS application.
 */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ExpensesModule } from './expenses/expenses.module';
import { BudgetsModule } from './budgets/budgets.module';
import { ParserModule } from './parser/parser.module';
import { PeerSplitsModule } from './peer-splits/peer-splits.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    SupabaseModule,
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
