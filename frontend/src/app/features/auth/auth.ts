import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

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
  private readonly API_URL = 'http://localhost:3000/auth';
  private readonly http = inject(HttpClient);

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>(`${this.API_URL}/login`, { email, password })
      .pipe(
        tap((response) => {
          if (response.accessToken) {
            sessionStorage.setItem(this.TOKEN_KEY, response.accessToken);
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
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  clearSession(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
  }
}
