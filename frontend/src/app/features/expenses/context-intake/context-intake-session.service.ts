import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { AuthService } from '../../auth/auth';

export const INTAKE_SESSION_TTL_MS = 30 * 60 * 1000;

export interface CachedConversation<T> {
  conversationId: string;
  lastActivityAt: string;
  expiresAt: string;
  value: T;
}

@Injectable({ providedIn: 'root' })
export class ContextIntakeSessionService {
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly prefix = 'xpense:intake';

  load<T>(): CachedConversation<T> | null {
    if (!this.isBrowser) return null;
    const userId = this.userId();
    const conversationId = sessionStorage.getItem(this.indexKey(userId));
    if (!conversationId) return null;
    const raw = sessionStorage.getItem(this.dataKey(userId, conversationId));
    if (!raw) {
      sessionStorage.removeItem(this.indexKey(userId));
      return null;
    }

    try {
      const cached = JSON.parse(raw) as CachedConversation<T>;
      if (Date.parse(cached.expiresAt) <= Date.now()) {
        this.clear();
        return null;
      }
      return cached;
    } catch {
      this.clear();
      return null;
    }
  }

  save<T>(conversationId: string, value: T): CachedConversation<T> | null {
    if (!this.isBrowser) return null;
    const userId = this.userId();
    const now = new Date();
    const cached: CachedConversation<T> = {
      conversationId,
      lastActivityAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + INTAKE_SESSION_TTL_MS).toISOString(),
      value,
    };
    sessionStorage.setItem(this.indexKey(userId), conversationId);
    sessionStorage.setItem(this.dataKey(userId, conversationId), JSON.stringify(cached));
    return cached;
  }

  clear(): void {
    if (!this.isBrowser) return;
    const userId = this.userId();
    const indexKey = this.indexKey(userId);
    const conversationId = sessionStorage.getItem(indexKey);
    if (conversationId) {
      sessionStorage.removeItem(this.dataKey(userId, conversationId));
    }
    sessionStorage.removeItem(indexKey);
  }

  private userId(): string {
    const token = this.auth.getAccessToken();
    if (!token) return 'anonymous';
    try {
      const payload = token.split('.')[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const decoded = JSON.parse(atob(normalized)) as { sub?: string | number };
      return String(decoded.sub ?? 'unknown');
    } catch {
      return 'unknown';
    }
  }

  private indexKey(userId: string): string {
    return `${this.prefix}:index:${userId}`;
  }

  private dataKey(userId: string, conversationId: string): string {
    return `${this.prefix}:${userId}:${conversationId}`;
  }
}
