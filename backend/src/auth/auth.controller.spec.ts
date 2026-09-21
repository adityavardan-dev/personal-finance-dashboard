import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    signup: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      signup: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates login to AuthService', () => {
    const dto = { email: 'user@example.com', password: 'password123' };
    const response = { message: 'Login successful', accessToken: 'token' };
    authService.login.mockReturnValue(response);

    expect(controller.login(dto)).toBe(response);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('delegates signup to AuthService', () => {
    const dto = {
      username: 'Test User',
      email: 'user@example.com',
      password: 'password123',
    };
    const response = {
      message: 'Signup successful',
      email: dto.email,
      username: dto.username,
    };
    authService.signup.mockReturnValue(response);

    expect(controller.signup(dto)).toBe(response);
    expect(authService.signup).toHaveBeenCalledWith(dto);
  });
});
