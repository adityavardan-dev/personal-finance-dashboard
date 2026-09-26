import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMine(@Request() req: any) {
    return this.usersService.getPublicProfile(req.user.userId as number);
  }

  @Put('me/preferences')
  updatePreferences(@Request() req: any, @Body() dto: UpdateUserPreferencesDto) {
    return this.usersService.updatePreferences(req.user.userId as number, dto.currency);
  }
}
