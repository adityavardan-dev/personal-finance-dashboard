import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class SignupComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

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

    this.authService.signup(name, email, password).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'Your account is ready. Redirecting you to sign in…';
        setTimeout(() => void this.router.navigate(['/login']), 900);
      },
      error: (error: { error?: { message?: string | string[] } }) => {
        this.isSubmitting = false;
        const message = error.error?.message;
        this.errorMessage = Array.isArray(message)
          ? message.join(' ')
          : message || 'We couldn’t create your account. Please try again.';
      },
    });
  }
}
