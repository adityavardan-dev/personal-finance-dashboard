/**
 * Purpose: Handles account authentication and JWT validation.
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
// The decorator tells Nest: "Register this class as a controller."

@Controller('auth')
export class AuthController {
  /** Creates this class and receives its required dependencies. */
  constructor(private readonly authService: AuthService) {}

  /** Handles login. */
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /** Handles signup. */
  @Post('signup')
  signup(@Body() signupDto: SignupDto) {
    // Implement signup logic here
    return this.authService.signup(signupDto);
  }
}
