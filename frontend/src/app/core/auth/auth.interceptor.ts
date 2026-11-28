import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../features/auth/auth';
import { API_CONFIG } from '../config/api.config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getAccessToken();
  const isApiRequest = req.url.startsWith(API_CONFIG.baseUrl);
  const isAuthRequest = req.url.startsWith(`${API_CONFIG.baseUrl}/auth/`);

  if (!isApiRequest || isAuthRequest) {
    return next(req);
  }

  const request = token ? req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }) : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && authService.getAccessToken() === token) {
        authService.expireSession();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url, sessionExpired: '1' } });
      }
      return throwError(() => error);
    }),
  );
};
