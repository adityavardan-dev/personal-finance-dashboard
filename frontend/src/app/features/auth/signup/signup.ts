import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class SignupComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  protected readonly signupForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  protected showPassword = false;
  protected showConfirmPassword = false;
  protected isSubmitting = false;
  protected errorMessage = '';

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

    if (this.signupForm.invalid || !this.passwordsMatch()) {
      this.signupForm.markAllAsTouched();
      if (!this.passwordsMatch()) {
        this.errorMessage = 'Passwords do not match.';
      }
      return;
    }

    // Registration API is not present in the current backend, so this checkpoint
    // intentionally implements the complete UI/form flow without inventing an endpoint.
    this.isSubmitting = true;
    this.errorMessage = 'Account creation will be connected when the registration API is added.';
    this.isSubmitting = false;
  }

  protected goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}
