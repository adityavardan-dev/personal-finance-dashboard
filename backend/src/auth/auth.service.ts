/**
 * Purpose: Handles account authentication and JWT validation.
 */
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { SupabaseRequestError, SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  /** Creates this class and receives its required dependencies. */
  constructor(private readonly supabase: SupabaseService) {}

  /** Handles login. */
  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    try {
      const result = await this.supabase.signInWithPassword(email, loginDto.password);
      return {
        message: 'Login successful',
        email: result.user.email ?? email,
        accessToken: result.access_token,
      };
    } catch (error) {
      if (!(error instanceof SupabaseRequestError)) throw error;
      throw new UnauthorizedException('Invalid email or password');
    }
  }

  /** Handles signup. */
  async signup(signupDto: SignupDto) {
    const email = signupDto.email.trim().toLowerCase();
    const username = signupDto.username.trim();
    try {
      const result = await this.supabase.signUp(username, email, signupDto.password);
      if (!result.user) throw new ConflictException('Unable to create account.');
      return { message: 'Signup successful', email, username };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof SupabaseRequestError) {
        if (error.status === HttpStatus.TOO_MANY_REQUESTS) {
          throw new HttpException(
            'Too many signup attempts. Please wait a minute and try again.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (/already|registered|exists/i.test(error.message)) {
          throw new ConflictException('An account with this email already exists');
        }
        if (error.status === 400 || error.status === 422) {
          throw new BadRequestException(error.message);
        }
      }
      throw error;
    }
  }
}
