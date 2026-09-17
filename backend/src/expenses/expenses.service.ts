import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { CreateExpenseDto } from './dto/create-expense.dto';

export interface Expense {
  id: string;
  userId: number;
  amount: number;
  category: string;
  merchant: string;
  date: string;
  note?: string;
  createdAt: string;
}

const DATA_FILE = path.join(process.cwd(), 'data', 'expenses.json');

@Injectable()
export class ExpensesService {
  private readAll(): Expense[] {
    try {
      if (!fs.existsSync(DATA_FILE)) return [];
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw) as Expense[];
    } catch {
      return [];
    }
  }

  private writeAll(expenses: Expense[]): void {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(expenses, null, 2), 'utf-8');
  }

  create(userId: number, dto: CreateExpenseDto): Expense {
    const expenses = this.readAll();
    const expense: Expense = {
      id: randomUUID(),
      userId,
      amount: dto.amount,
      category: dto.category,
      merchant: dto.merchant,
      date: dto.date,
      note: dto.note,
      createdAt: new Date().toISOString(),
    };
    expenses.push(expense);
    this.writeAll(expenses);
    return expense;
  }

  findByUser(userId: number): Expense[] {
    return this.readAll().filter((e) => e.userId === userId);
  }
}
