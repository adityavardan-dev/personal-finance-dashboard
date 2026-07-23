import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {

    constructor(
        private readonly jwtService: JwtService,
    ) { }

    async login(loginDto: LoginDto) {

        const user = {
            id: 1,
            email: 'admin@test.com',
            password: 'password123',
        };
        
        if (user.email !== loginDto.email || user.password !== loginDto.password) {
            throw new UnauthorizedException('Invalid email or password');
        }
        const payload = { sub: user.id, email: user.email };

        // Generate a JWT token using the JwtService
        const accessToken = await this.jwtService.signAsync(payload);

        return {
            message: 'Login successful',
            email: loginDto.email,
            accessToken: accessToken,
        };
    };

    signup(signupDto: SignupDto) {
        return {
            message: 'Signup successful',
            email: signupDto.email,
            username: signupDto.username,
        };
    }
}
