import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

interface LoginResponse {
  accessToken: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private readonly TOKEN_KEY = 'accessToken';

  private http = inject(HttpClient);

  login(email: string, password: string) {
    return this.http
    .post<LoginResponse>(
      'http://localhost:3000/auth/login',
      { email, password }
    )
    .pipe(
      // Handle the response and store the access token in local storage
      tap((response: LoginResponse) => {
        sessionStorage.setItem(this.TOKEN_KEY, response.accessToken);
      })
    );
  }

}
