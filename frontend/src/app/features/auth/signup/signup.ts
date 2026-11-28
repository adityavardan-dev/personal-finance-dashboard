import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth';
import { WelcomeIntroComponent } from '../welcome-intro/welcome-intro';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink, WelcomeIntroComponent],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class SignupComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly signupForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  protected showPassword = false;
  protected showConfirmPassword = false;
  protected isSubmitting = false;
  protected errorMessage = '';
  protected successMessage = '';
  protected readonly welcomeHighlight = signal(false);
  private highlightTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.highlightTimer));
  }

  protected onWelcomeFinished(): void {
    this.welcomeHighlight.set(true);
    clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.welcomeHighlight.set(false), 1000);
  }

  protected togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  protected toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  protected passwordsMatch(): boolean {
    return this.signupForm.controls.password.value === this.signupForm.controls.confirmPassword.value;
  }

  protected submit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.signupForm.invalid || !this.passwordsMatch()) {
      this.signupForm.markAllAsTouched();
      if (!this.passwordsMatch()) {
        this.errorMessage = 'Passwords do not match.';
      }
      return;
    }

    this.isSubmitting = true;
    const { name, email, password } = this.signupForm.getRawValue();
    this.signupForm.disable({ emitEvent: false });

    this.authService.signup(name, email, password).subscribe({
      next: () => {
        this.signupForm.enable({ emitEvent: false });
        this.isSubmitting = false;
        this.successMessage = 'Check your email to confirm your account. Redirecting you to sign in…';
        setTimeout(() => void this.router.navigate(['/login']), 900);
      },
      error: (error: { error?: { message?: string | string[] } }) => {
        this.signupForm.enable({ emitEvent: false });
        this.isSubmitting = false;
        const message = error.error?.message;
        this.errorMessage = Array.isArray(message)
          ? message.join(' ')
          : message || 'We couldn’t create your account. Please try again.';
      },
    });
  }
}
