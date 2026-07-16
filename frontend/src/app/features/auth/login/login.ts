import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

// The decorator @Component is used to define a component in Angular. 
// It takes an object with metadata properties that describe the component, 
// such as its selector, template, and styles. 
@Component({
  selector: 'app-login',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {

  // The inject function is used to inject dependencies into the component.
  private router = inject(Router);

  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  })

  constructor() {
    // Initialize the login form
    // console.log(this.loginForm);
  }

  login() {
    // console.log('Login clicked', this.loginForm);
    // This method is called when the user clicks the login button.
    // It navigates the user to the '/dashboard' route using the Router service.
    this.router.navigate(['/dashboard']);
  }

  logClick() {
    console.log('Signup clicked');
  }
}
