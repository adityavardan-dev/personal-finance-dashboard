import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
}

const DATA_FILE = path.join(process.cwd(), 'data', 'users.json');

@Injectable()
export class UsersService {
  private readAll(): User[] {
    try {
      if (!fs.existsSync(DATA_FILE)) return [];
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw) as User[];
    } catch {
      return [];
    }
  }

  private writeAll(users: User[]): void {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf-8');
  }

  findByEmail(email: string): User | undefined {
    const normalizedEmail = this.normalizeEmail(email);
    return this.readAll().find((user) => user.email === normalizedEmail);
  }

  findById(id: number): User | undefined {
    return this.readAll().find((user) => user.id === id);
  }

  create(username: string, email: string, password: string): User {
    const users = this.readAll();
    const normalizedEmail = this.normalizeEmail(email);

    const user: User = {
      id: this.generateId(users),
      username: username.trim(),
      email: normalizedEmail,
      password,
    };

    users.push(user);
    this.writeAll(users);
    return user;
  }

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private generateId(users: User[]): number {
    const ids = new Set(users.map((user) => user.id));
    let id = users.length + 1;
    while (ids.has(id)) {
      id += 1;
    }
    return id;
  }
}
