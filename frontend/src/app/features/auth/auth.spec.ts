import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from './auth';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('posts signup credentials to the auth endpoint', () => {
    service.signup('Test User', 'test@example.com', 'password123').subscribe((response) => {
      expect(response).toEqual({
        message: 'Signup successful',
        email: 'test@example.com',
        username: 'Test User',
      });
    });

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/signup'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      username: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });
    request.flush({
      message: 'Signup successful',
      email: 'test@example.com',
      username: 'Test User',
    });
  });

  it('clears the token and temporary intake conversations on logout', () => {
    sessionStorage.setItem('accessToken', 'token');
    sessionStorage.setItem('xpense:intake:index:1', 'conversation');
    sessionStorage.setItem('xpense:split:1', 'temporary split');
    sessionStorage.setItem('unrelated', 'keep');

    service.clearSession();

    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('xpense:intake:index:1')).toBeNull();
    expect(sessionStorage.getItem('xpense:split:1')).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
    sessionStorage.removeItem('unrelated');
  });
});
