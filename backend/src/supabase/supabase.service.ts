/** Makes authenticated server-side requests to Supabase without exposing secrets to clients. */
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export class SupabaseRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

@Injectable()
export class SupabaseService {
  /** Creates an account; the database trigger creates its profile and preferences. */
  async signUp(username: string, email: string, password: string) {
    const result = await this.request<SupabaseUser | { user: SupabaseUser | null }>(
      '/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, data: { username } }),
      },
    );
    return { user: 'user' in result ? result.user : result };
  }

  /** Exchanges an email and password for a Supabase access token. */
  signInWithPassword(email: string, password: string) {
    return this.request<{ access_token: string; user: SupabaseUser }>(
      '/auth/v1/token?grant_type=password',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
  }

  /** Asks Supabase Auth to send a fresh confirmation email for a pending signup. */
  resendSignupConfirmation(email: string) {
    return this.request<Record<string, never>>('/auth/v1/resend', {
      method: 'POST',
      body: JSON.stringify({ type: 'signup', email }),
    });
  }

  /** Validates a bearer token against Supabase Auth and returns its owner. */
  getUser(accessToken: string) {
    return this.request<SupabaseUser>('/auth/v1/user', { method: 'GET' }, accessToken);
  }

  /** Calls the PostgREST Data API as the authenticated user so RLS remains authoritative. */
  data<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
    return this.request<T>(`/rest/v1/${path}`, init, accessToken);
  }

  private async request<T>(path: string, init: RequestInit, accessToken?: string): Promise<T> {
    const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
    const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url || !key) throw new ServiceUnavailableException('Supabase is not configured.');
    let response: Response;
    try {
      response = await fetch(`${url}${path}`, {
        ...init,
        signal: AbortSignal.timeout(15000),
        headers: {
          apikey: key,
          Authorization: `Bearer ${accessToken ?? key}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
    } catch {
      throw new ServiceUnavailableException('Supabase is unavailable.');
    }
    const raw = await response.text();
    let body: unknown = null;
    if (raw) {
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        body = raw;
      }
    }
    if (!response.ok) {
      const message = getErrorMessage(body);
      const code = isRecord(body)
        ? stringValue(body['code']) ?? stringValue(body['error_code'])
        : undefined;
      throw new SupabaseRequestError(response.status, message, code);
    }
    return body as T;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function getErrorMessage(body: unknown): string {
  if (!isRecord(body)) return 'Supabase request failed.';
  return stringValue(body['message'])
    ?? stringValue(body['msg'])
    ?? stringValue(body['error_description'])
    ?? stringValue(body['error'])
    ?? 'Supabase request failed.';
}
