import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {
  private router = inject(Router);

  logout() {
    // This method is called when the user clicks the logout button.
    // It navigates the user back to the '/login' route using the Router service.
    this.router.navigate(['/login']);
  }
}
