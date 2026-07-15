import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

// The decorator @Component is used to define a component in Angular. 
// It takes an object with metadata properties that describe the component, 
// such as its selector, template, and styles. 
@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {

  // The inject function is used to inject dependencies into the component.
  private router = inject(Router);

  login() {
    // This method is called when the user clicks the login button.
    // It navigates the user to the '/dashboard' route using the Router service.
    this.router.navigate(['/dashboard']);
  }
}
