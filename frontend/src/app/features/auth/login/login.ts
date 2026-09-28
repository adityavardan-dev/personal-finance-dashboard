import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { safeInternalReturnUrl } from '../../../core/auth/session-expiry.service';
import { AuthService } from '../auth';

@Component({
  selector: 'app-login',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
  });

  readonly sessionMessage = this.route.snapshot.queryParamMap.get('reason') === 'session-expired'
    ? 'Your session expired. Sign in again to continue.'
    : '';
  private readonly returnUrl = safeInternalReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  showPassword = false;
  isSubmitting = false;
  errorMessage = '';

  login(): void {
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      queueMicrotask(() => document.querySelector<HTMLElement>('#email[aria-invalid="true"], #password[aria-invalid="true"]')?.focus());
      return;
    }

    this.isSubmitting = true;
    const { email, password } = this.loginForm.getRawValue();
    this.loginForm.disable({ emitEvent: false });

    this.authService.login(email, password).subscribe({
      next: () => {
        this.loginForm.enable({ emitEvent: false });
        this.isSubmitting = false;
        void this.router.navigateByUrl(this.returnUrl);
      },
      error: () => {
        this.loginForm.enable({ emitEvent: false });
        this.isSubmitting = false;
        this.errorMessage = 'We couldn’t sign you in. Check your email and password and try again.';
      },
    });
  }
}
