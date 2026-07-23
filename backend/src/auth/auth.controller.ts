import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
// The decorator tells Nest: "Register this class as a controller."

@Controller('auth')
export class AuthController {

    constructor(private readonly authService: AuthService) {}
    
    @Post('login')
    login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    };

    @Post('signup')
    signup(@Body() signupDto: SignupDto) {
        // Implement signup logic here
        return this.authService.signup(signupDto);
    };
}
