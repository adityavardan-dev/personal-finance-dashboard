/**
 * Purpose: Handles account authentication and JWT validation.
 */
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  /** Validates the Supabase bearer token and attaches its trusted identity. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { userId: string; email?: string; accessToken: string };
    }>();
    const authorization = request.headers.authorization;
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Authentication required.');
    try {
      const user = await this.supabase.getUser(token);
      request.user = { userId: user.id, email: user.email, accessToken: token };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session.');
    }
  }
}
