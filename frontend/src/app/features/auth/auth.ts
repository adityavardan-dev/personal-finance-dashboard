import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { API_CONFIG } from '../../core/config/api.config';

interface AuthResponse {
  accessToken?: string;
  message: string;
  email: string;
  username?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly TOKEN_KEY = 'accessToken';
  private readonly API_URL = `${API_CONFIG.baseUrl}/auth`;
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly sessionVersion = signal(0);

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, { email, password }).pipe(
      tap((response) => {
        if (this.isBrowser && response.accessToken) {
          sessionStorage.setItem(this.TOKEN_KEY, response.accessToken);
          this.sessionVersion.update((version) => version + 1);
        }
      }),
    );
  }

  signup(username: string, email: string, password: string) {
    return this.http.post<AuthResponse>(`${this.API_URL}/signup`, {
      username,
      email,
      password,
    });
  }

  getAccessToken(): string | null {
    return this.isBrowser ? sessionStorage.getItem(this.TOKEN_KEY) : null;
  }

  clearSession(): void {
    if (this.isBrowser) {
      const intakeKeys = Array.from({ length: sessionStorage.length }, (_, index) =>
        sessionStorage.key(index),
      ).filter((key): key is string =>
        Boolean(key?.startsWith('xpense:intake:') || key?.startsWith('xpense:split:')),
      );
      intakeKeys.forEach((key) => sessionStorage.removeItem(key));
      sessionStorage.removeItem(this.TOKEN_KEY);
      this.sessionVersion.update((version) => version + 1);
    }
  }
}
