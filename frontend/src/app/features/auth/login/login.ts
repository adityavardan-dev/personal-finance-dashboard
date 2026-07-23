import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { AuthService } from '../auth';

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
  private authService = inject(AuthService);

  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  })

  constructor() {
    // Initialize the login form
    // console.log(this.loginForm);
  }

    login() {

      if (this.loginForm.invalid) {
        console.log('Form is invalid');
        return;
      }

      const email = this.loginForm.get('email')?.value;
      const password = this.loginForm.get('password')?.value;

      return this.authService.login(email!, password!).subscribe({
        next: (response) => {
          console.log('Login successful:', response);
          // Navigate to the dashboard after successful login
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          console.error('Login failed:', error);
          // Handle login error (e.g., show an error message to the user)
        }
      });
    }

  logClick() {
    console.log('Signup clicked');
  }
}
