import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { TransactionType } from './transaction-type';

export interface Expense {
  id: string;
  userId: number;
  type: TransactionType;
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
      const expenses = JSON.parse(raw) as Array<Omit<Expense, 'type'> & { type?: TransactionType }>;
      return expenses.map((expense) => ({
        ...expense,
        type: expense.type ?? TransactionType.Expense,
      }));
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
      type: dto.type,
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

  findOne(userId: number, id: string): Expense {
    const expense = this.readAll().find((e) => e.id === id && e.userId === userId);
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    return expense;
  }

  update(userId: number, id: string, dto: UpdateExpenseDto): Expense {
    const expenses = this.readAll();
    const index = expenses.findIndex((e) => e.id === id && e.userId === userId);
    if (index === -1) throw new NotFoundException(`Expense ${id} not found`);

    const existing = expenses[index];
    const updated: Expense = {
      id: existing.id,
      userId: existing.userId,
      createdAt: existing.createdAt,
      type: dto.type ?? existing.type,
      amount: dto.amount ?? existing.amount,
      category: dto.category ?? existing.category,
      merchant: dto.merchant ?? existing.merchant,
      date: dto.date ?? existing.date,
      note: dto.note !== undefined ? dto.note : existing.note,
    };
    expenses[index] = updated;
    this.writeAll(expenses);
    return updated;
  }

  remove(userId: number, id: string): Expense {
    const expenses = this.readAll();
    const index = expenses.findIndex((e) => e.id === id && e.userId === userId);
    if (index === -1) throw new NotFoundException(`Expense ${id} not found`);

    const [removed] = expenses.splice(index, 1);
    this.writeAll(expenses);
    return removed;
  }
}
