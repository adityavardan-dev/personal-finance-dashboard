import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class Auth {

  private http = inject(HttpClient);

  login(email: string, password: string) {
    return this.http.post(
      'http://localhost:3000/auth/login',
      { email, password }
    );
  }

}
