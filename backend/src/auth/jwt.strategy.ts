/**
 * Purpose: Handles account authentication and JWT validation.
 */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /** Creates this class and receives its required dependencies. */
  constructor() {
    super({
      // Extract JWT from the Authorization header
      // Example: Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Reject expired tokens
      ignoreExpiration: false,

      // Must match the secret used in JwtModule.register()
      secretOrKey: 'mySuperSecretKey',
    });
  }

  /**
   * This method is called only after:
   * 1. The JWT is successfully extracted
   * 2. The signature is verified
   * 3. The token is not expired
   */
  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
