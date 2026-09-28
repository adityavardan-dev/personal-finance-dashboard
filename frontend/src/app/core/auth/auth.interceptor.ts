import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../features/auth/auth';
import { API_CONFIG } from '../config/api.config';
import { SessionExpiryService } from './session-expiry.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();
  const isApiRequest = req.url.startsWith(API_CONFIG.baseUrl);
  const isAuthRequest = req.url.startsWith(`${API_CONFIG.baseUrl}/auth/`);

  if (!token || !isApiRequest || isAuthRequest) {
    return next(req);
  }

  const sessionExpiry = inject(SessionExpiryService);

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  ).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) sessionExpiry.handleUnauthorized();
      return throwError(() => error);
    }),
  );
};
