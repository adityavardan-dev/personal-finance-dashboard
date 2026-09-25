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
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function fillInput(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function fillForm({
    name = 'Test User',
    email = 'test@example.com',
    password = 'password123',
    confirmPassword = password,
  }: Partial<{ name: string; email: string; password: string; confirmPassword: string }> = {}): void {
    fillInput('#name', name);
    fillInput('#email', email);
    fillInput('#password', password);
    fillInput('#confirm-password', confirmPassword);
    fixture.detectChanges();
  }

  function submitForm(): void {
    const submitButton = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    submitButton.click();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not submit an invalid form', () => {
    submitForm();

    expect(fixture.nativeElement.querySelector('#signup-error')).toBeNull();
    expect(fixture.nativeElement.querySelector('#name-error')).toBeTruthy();
    expect(httpMock.match(() => true)).toHaveLength(0);
  });

  it('rejects mismatched passwords before calling the API', () => {
    fillForm({ confirmPassword: 'different123' });
    submitForm();

    expect(fixture.nativeElement.querySelector('#signup-error')?.textContent).toContain(
      'Passwords do not match.',
    );
    expect(httpMock.match(() => true)).toHaveLength(0);
  });

  it('submits valid signup data and displays submitting and success states', () => {
    vi.useFakeTimers();
    fillForm({ email: 'Test@Example.com' });
    submitForm();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/signup'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      username: 'Test User',
      email: 'Test@Example.com',
      password: 'password123',
    });

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const submitButton = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(submitButton.disabled).toBe(true);
    expect(submitButton.textContent).toContain('Creating account');

    request.flush({
      message: 'Signup successful',
      email: 'test@example.com',
      username: 'Test User',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#signup-success')?.textContent).toContain(
      'Your account is ready',
    );
    expect(form.getAttribute('aria-busy')).toBe('false');
    expect(submitButton.disabled).toBe(false);
  });

  it('redirects to login after successful signup', async () => {
    vi.useFakeTimers();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fillForm();
    submitForm();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/signup'));
    request.flush({
      message: 'Signup successful',
      email: 'test@example.com',
      username: 'Test User',
    });

    await vi.advanceTimersByTimeAsync(900);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('displays duplicate-email errors from the API', async () => {
    fillForm({ email: 'existing@example.com' });
    submitForm();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/signup'));
    request.flush(
      { message: 'An account with this email already exists' },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#signup-error')?.textContent).toContain(
      'An account with this email already exists',
    );
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    expect(form.getAttribute('aria-busy')).toBe('false');
  });

  it('displays validation errors returned by the API', async () => {
    fillForm();
    submitForm();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/signup'));
    request.flush(
      { message: ['email must be an email', 'password is too short'] },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#signup-error')?.textContent).toContain(
      'email must be an email password is too short',
    );
  });

  it('displays a fallback message when account creation fails', async () => {
    fillForm();
    submitForm();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/signup'));
    request.flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#signup-error')?.textContent).toContain(
      'We couldn’t create your account. Please try again.',
    );
  });
});
