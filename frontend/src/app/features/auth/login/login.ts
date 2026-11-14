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
  readonly welcomeHighlight = signal(false);
  private highlightTimer: ReturnType<typeof setTimeout> | undefined;
  readonly sessionExpired = this.route.snapshot.queryParamMap.get('sessionExpired') === '1';

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.highlightTimer));
  }

  onWelcomeFinished(): void {
    this.welcomeHighlight.set(true);
    clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.welcomeHighlight.set(false), 1000);
  }

  login(): void {
    this.errorMessage = '';

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
      error: () => {
        this.loginForm.enable({ emitEvent: false });
        this.isSubmitting = false;
        this.errorMessage = 'We couldn’t sign you in. Check your email and password and try again.';
      },
    });
  }
}
