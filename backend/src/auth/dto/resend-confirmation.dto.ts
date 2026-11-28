/** Validates requests to resend a signup confirmation email. */
import { IsEmail } from 'class-validator';

export class ResendConfirmationDto {
  /** Email address whose pending signup confirmation should be resent. */
  @IsEmail()
  email!: string;
}
