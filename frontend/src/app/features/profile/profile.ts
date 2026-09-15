import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AppLayout } from '../../shared/app-layout/app-layout';
import { AuthService } from '../auth/auth';

@Component({
  selector: 'app-profile',
  imports: [AppLayout, RouterLink],
  templateUrl: './profile.html',
})
export class ProfileComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly user = { name: 'Aditya Vardan G', email: 'admin@test.com', initials: 'AG' };
  readonly preferences = [
    { label: 'Currency', value: 'Indian Rupee (₹)' },
    { label: 'Appearance', value: 'System default' },
  ];

  protected logout(): void {
    this.authService.clearSession();
    void this.router.navigate(['/login']);
  }
}
