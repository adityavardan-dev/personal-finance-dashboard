import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { SignupComponent } from './signup';

describe('SignupComponent', () => {
  let component: SignupComponent;
  let fixture: ComponentFixture<SignupComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: SignupComponent }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SignupComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not submit an invalid form', () => {
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#signup-error')?.textContent).not.toContain(
      'couldn’t create',
    );
    expect(fixture.nativeElement.querySelector('#name-error')).toBeTruthy();
    expect(httpMock.match(() => true)).toHaveLength(0);
  });

  it('rejects mismatched passwords before calling the API', () => {
    component.signupForm.setValue({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'different123',
    });
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#signup-error')?.textContent).toContain(
      'Passwords do not match.',
    );
    expect(httpMock.match(() => true)).toHaveLength(0);
  });

  it('submits valid signup data and displays success', () => {
    component.signupForm.setValue({
      name: 'Test User',
      email: 'Test@Example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitButton.click();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/signup'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      username: 'Test User',
      email: 'Test@Example.com',
      password: 'password123',
    });

    request.flush({
      message: 'Signup successful',
      email: 'test@example.com',
      username: 'Test User',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#signup-success')?.textContent).toContain(
      'Your account is ready',
    );
    expect(component.isSubmitting).toBe(false);
  });

  it('redirects to login after successful signup', async () => {
    vi.useFakeTimers();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.signupForm.setValue({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    component.submit();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/signup'));
    request.flush({
      message: 'Signup successful',
      email: 'test@example.com',
      username: 'Test User',
    });

    await vi.advanceTimersByTimeAsync(900);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('displays duplicate-email errors from the API', () => {
    component.signupForm.setValue({
      name: 'Test User',
      email: 'existing@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    component.submit();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/signup'));
    request.flush(
      { message: 'An account with this email already exists' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#signup-error')?.textContent).toContain(
      'An account with this email already exists',
    );
    expect(component.isSubmitting).toBe(false);
  });

  it('displays validation errors returned by the API', () => {
    component.signupForm.setValue({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    component.submit();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/signup'));
    request.flush(
      { message: ['email must be an email', 'password is too short'] },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#signup-error')?.textContent).toContain(
      'email must be an email password is too short',
    );
  });
});
