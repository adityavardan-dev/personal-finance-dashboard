/** Verifies that Nest auth delegates credentials to Supabase Auth. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseRequestError, SupabaseService } from '../supabase/supabase.service';

describe('AuthService', () => {
  const supabase = {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    resendSignupConfirmation: jest.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(supabase as unknown as SupabaseService);
  });

  it('creates a fresh Supabase account with normalized identity fields', async () => {
    supabase.signUp.mockResolvedValue({ user: { id: 'user-1', email: 'new@example.com' } });
    await expect(service.signup({
      username: ' New User ',
      email: ' NEW@EXAMPLE.COM ',
      password: 'password123',
    })).resolves.toEqual({
      message: 'Signup successful',
      email: 'new@example.com',
      username: 'New User',
    });
    expect(supabase.signUp).toHaveBeenCalledWith('New User', 'new@example.com', 'password123');
  });

  it('maps a duplicate Supabase signup to a conflict', async () => {
    supabase.signUp.mockRejectedValue(new SupabaseRequestError(422, 'already registered'));
    await expect(service.signup({
      username: 'User', email: 'user@example.com', password: 'password123',
    })).rejects.toThrow(ConflictException);
  });

  it('keeps non-duplicate signup validation errors distinct', async () => {
    supabase.signUp.mockRejectedValue(new SupabaseRequestError(400, 'Email address is invalid'));
    await expect(service.signup({
      username: 'User', email: 'user@example.com', password: 'password123',
    })).rejects.toThrow(BadRequestException);
  });

  it('returns a useful response when Supabase signup is rate limited', async () => {
    supabase.signUp.mockRejectedValue(new SupabaseRequestError(429, 'Email rate limit exceeded'));
    await expect(service.signup({
      username: 'User', email: 'user@example.com', password: 'password123',
    })).rejects.toMatchObject({ status: 429 });
  });

  it('returns the Supabase access token used by the frontend', async () => {
    supabase.signInWithPassword.mockResolvedValue({
      access_token: 'access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    });
    await expect(service.login({
      email: ' USER@EXAMPLE.COM ', password: 'password123',
    })).resolves.toEqual({
      message: 'Login successful',
      email: 'user@example.com',
      accessToken: 'access-token',
    });
  });

  it('maps invalid Supabase credentials to an unauthorized response', async () => {
    supabase.signInWithPassword.mockRejectedValue(new SupabaseRequestError(400, 'invalid'));
    await expect(service.login({
      email: 'user@example.com', password: 'wrong-password',
    })).rejects.toThrow(UnauthorizedException);
  });

  it('keeps an unconfirmed login distinct so the UI can offer resend', async () => {
    supabase.signInWithPassword.mockRejectedValue(
      new SupabaseRequestError(400, 'Email not confirmed', 'email_not_confirmed'),
    );
    await expect(service.login({
      email: 'user@example.com', password: 'password123',
    })).rejects.toThrow(ForbiddenException);
  });

  it('resends a confirmation email using a normalized address', async () => {
    supabase.resendSignupConfirmation.mockResolvedValue({});
    await expect(service.resendConfirmation({ email: ' USER@EXAMPLE.COM ' })).resolves.toEqual({
      message: 'If an unconfirmed account exists, a new confirmation email has been sent.',
    });
    expect(supabase.resendSignupConfirmation).toHaveBeenCalledWith('user@example.com');
  });

  it('reports confirmation email rate limits without confirming or signing in the user', async () => {
    supabase.resendSignupConfirmation.mockRejectedValue(
      new SupabaseRequestError(429, 'Email rate limit exceeded', 'over_email_send_rate_limit'),
    );
    await expect(service.resendConfirmation({ email: 'user@example.com' }))
      .rejects.toMatchObject({ status: 429 });
  });
});
