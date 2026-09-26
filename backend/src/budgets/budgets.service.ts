import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CurrencyCode } from './currency-code';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

export interface CategoryBudgetLimit {
  category: string;
  limit: number;
}

export interface Budget {
  userId: number;
  monthlyLimit: number | null;
  categoryLimits: CategoryBudgetLimit[];
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetResponse {
  monthlyLimit: number | null;
  categoryLimits: CategoryBudgetLimit[];
  currency: CurrencyCode;
  createdAt: string | null;
  updatedAt: string | null;
}

const DATA_FILE = path.join(process.cwd(), 'data', 'budgets.json');
const EMPTY_BUDGET: BudgetResponse = {
  monthlyLimit: null,
  categoryLimits: [],
  currency: CurrencyCode.INR,
  createdAt: null,
  updatedAt: null,
};

@Injectable()
export class BudgetsService {
  getMine(userId: number): BudgetResponse {
    const budget = this.readAll().find((record) => record.userId === userId);
    return budget ? this.toResponse(budget) : { ...EMPTY_BUDGET, categoryLimits: [] };
  }

  upsert(userId: number, dto: UpsertBudgetDto): BudgetResponse {
    if (dto.monthlyLimit === null && dto.categoryLimits.length > 0) {
      throw new BadRequestException('Category limits require a monthly budget');
    }

    const categoryLimits = dto.categoryLimits.map((entry) => ({
      category: entry.category.trim(),
      limit: entry.limit,
    }));
    const names = categoryLimits.map((entry) => entry.category);
    if (names.some((name) => !name)) {
      throw new BadRequestException('Category budget names cannot be empty');
    }
    if (new Set(names).size !== names.length) {
      throw new BadRequestException('Category budget names must be unique');
    }

    const budgets = this.readAll();
    const index = budgets.findIndex((record) => record.userId === userId);
    const now = new Date().toISOString();
    const budget: Budget = {
      userId,
      monthlyLimit: dto.monthlyLimit,
      categoryLimits,
      currency: dto.currency,
      createdAt: index === -1 ? now : budgets[index].createdAt,
      updatedAt: now,
    };

    if (index === -1) budgets.push(budget);
    else budgets[index] = budget;
    this.writeAll(budgets);
    return this.toResponse(budget);
  }

  private readAll(): Budget[] {
    try {
      if (!fs.existsSync(DATA_FILE)) return [];
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as Budget[];
    } catch {
      return [];
    }
  }

  private writeAll(budgets: Budget[]): void {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(budgets, null, 2), 'utf-8');
  }

  private toResponse(budget: Budget): BudgetResponse {
    return {
      monthlyLimit: budget.monthlyLimit,
      categoryLimits: budget.categoryLimits,
      currency: budget.currency,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
}
