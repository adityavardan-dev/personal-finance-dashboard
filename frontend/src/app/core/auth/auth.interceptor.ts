import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../../features/auth/auth';
import { API_CONFIG } from '../config/api.config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();
  const isApiRequest = req.url.startsWith(API_CONFIG.baseUrl);
  const isAuthRequest = req.url.startsWith(`${API_CONFIG.baseUrl}/auth/`);

  if (!token || !isApiRequest || isAuthRequest) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
