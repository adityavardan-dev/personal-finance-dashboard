/**
 * Purpose: Handles user profile and preference operations.
 */
import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  /** Creates this class and receives its required dependencies. */
  constructor(private readonly usersService: UsersService) {}

  /** Returns get mine. */
  @Get('me')
  getMine(@Request() req: any) {
    return this.usersService.getPublicProfile(req.user.userId as number);
  }

  /** Handles update preferences. */
  @Put('me/preferences')
  updatePreferences(
    @Request() req: any,
    @Body() dto: UpdateUserPreferencesDto,
  ) {
    return this.usersService.updatePreferences(
      req.user.userId as number,
      dto.currency,
    );
  }
}
