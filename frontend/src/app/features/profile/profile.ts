import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppLayout } from '../../shared/app-layout/app-layout';

@Component({
  selector: 'app-profile',
  imports: [AppLayout, RouterLink],
  templateUrl: './profile.html',
})
export class ProfileComponent {
  readonly user = {
    name: 'Aditya Vardan G',
    email: 'admin@test.com',
    initials: 'AG',
  };

  readonly preferences = [
    { label: 'Currency', value: 'Indian Rupee (₹)' },
    { label: 'Appearance', value: 'System default' },
  ];
}
