import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async login(loginDto: LoginDto) {
    const email = this.usersService.normalizeEmail(loginDto.email);
    const user = this.usersService.findByEmail(email);

    if (!user || user.password !== loginDto.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      message: 'Login successful',
      email: user.email,
      accessToken,
    };
  }

  signup(signupDto: SignupDto) {
    const email = this.usersService.normalizeEmail(signupDto.email);

    if (this.usersService.findByEmail(email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = this.usersService.create(signupDto.username, email, signupDto.password);

    return {
      message: 'Signup successful',
      email: user.email,
      username: user.username,
    };
  }
}
