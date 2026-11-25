import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { AuthService } from '../auth';
import { WelcomeIntroComponent } from '../welcome-intro/welcome-intro';

@Component({
  selector: 'app-login',
  imports: [RouterLink, ReactiveFormsModule, WelcomeIntroComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
  });

  showPassword = false;
  isSubmitting = false;
  errorMessage = '';
  confirmationMessage = '';
  showResendConfirmation = false;
  isResendingConfirmation = false;
  resendCooldownSeconds = 0;
  readonly welcomeHighlight = signal(false);
  private highlightTimer: ReturnType<typeof setTimeout> | undefined;
  private resendTimer: ReturnType<typeof setInterval> | undefined;
  readonly sessionExpired = this.route.snapshot.queryParamMap.get('sessionExpired') === '1';

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.highlightTimer);
      clearInterval(this.resendTimer);
    });
  }

  onWelcomeFinished(): void {
    this.welcomeHighlight.set(true);
    clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.welcomeHighlight.set(false), 1000);
  }

  login(): void {
    this.errorMessage = '';
    this.confirmationMessage = '';
    this.showResendConfirmation = false;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const { email, password } = this.loginForm.getRawValue();
    this.loginForm.disable({ emitEvent: false });

    this.authService.login(email, password).subscribe({
      next: () => {
        this.loginForm.enable({ emitEvent: false });
        this.isSubmitting = false;
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/dashboard');
      },
      error: (error: { error?: { message?: string; code?: string } }) => {
        this.loginForm.enable({ emitEvent: false });
        this.isSubmitting = false;
        if (error.error?.code === 'EMAIL_NOT_CONFIRMED') {
          this.errorMessage = 'Confirm your email before signing in.';
          this.showResendConfirmation = true;
          return;
        }
        this.errorMessage = 'We couldn’t sign you in. Check your email and password and try again.';
      },
    });
  }

  resendConfirmation(): void {
    const email = this.loginForm.controls.email.value.trim();
    if (!email || this.loginForm.controls.email.invalid || this.resendCooldownSeconds > 0) return;

    this.isResendingConfirmation = true;
    this.confirmationMessage = '';
    this.authService.resendConfirmation(email).subscribe({
      next: (response) => {
        this.isResendingConfirmation = false;
        this.confirmationMessage = response.message;
        this.startResendCooldown(60);
      },
      error: (error: { status?: number; error?: { message?: string } }) => {
        this.isResendingConfirmation = false;
        this.confirmationMessage = error.status === 429
          ? 'Too many emails were requested. Please wait before trying again.'
          : error.error?.message || 'We could not send the confirmation email. Please try again.';
        if (error.status === 429) this.startResendCooldown(60);
      },
    });
  }

  private startResendCooldown(seconds: number): void {
    clearInterval(this.resendTimer);
    this.resendCooldownSeconds = seconds;
    this.resendTimer = setInterval(() => {
      this.resendCooldownSeconds = Math.max(0, this.resendCooldownSeconds - 1);
      if (this.resendCooldownSeconds === 0) clearInterval(this.resendTimer);
    }, 1000);
  }
}
