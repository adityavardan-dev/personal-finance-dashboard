import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {

    login(loginDto: LoginDto) {
        return {
            message: 'Login successful',
            email: loginDto.email,
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
