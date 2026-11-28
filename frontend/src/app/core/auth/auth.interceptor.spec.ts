import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../features/auth/auth';
import { API_CONFIG } from '../config/api.config';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  it('redirects an expired split preview to sign-in without deleting temporary splits', () => {
    const auth = { getAccessToken: vi.fn().mockReturnValue('expired-token'), expireSession: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const http = TestBed.inject(HttpTestingController);

    TestBed.inject(HttpClient).post(`${API_CONFIG.baseUrl}/peer-splits/preview`, {}).subscribe({ error: () => undefined });
    const request = http.expectOne(`${API_CONFIG.baseUrl}/peer-splits/preview`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer expired-token');
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.expireSession).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: router.url, sessionExpired: '1' },
    });
    http.verify();
  });
});
