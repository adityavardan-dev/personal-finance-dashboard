import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService, User } from './users.service';

const existingUser: User = {
  id: 7,
  username: 'Existing User',
  email: 'existing@example.com',
  password: 'password123',
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    normalizeEmail: jest.Mock;
    create: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
      create: jest.fn(),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('test-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('signs up a new persisted user', () => {
    usersService.findByEmail.mockReturnValue(undefined);
    usersService.create.mockReturnValue({
      id: 8,
      username: 'New User',
      email: 'new@example.com',
      password: 'password123',
    });

    const result = service.signup({
      username: 'New User',
      email: ' NEW@EXAMPLE.COM ',
      password: 'password123',
    });

    expect(usersService.normalizeEmail).toHaveBeenCalledWith(' NEW@EXAMPLE.COM ');
    expect(usersService.findByEmail).toHaveBeenCalledWith('new@example.com');
    expect(usersService.create).toHaveBeenCalledWith('New User', 'new@example.com', 'password123');
    expect(result).toEqual({
      message: 'Signup successful',
      email: 'new@example.com',
      username: 'New User',
    });
    expect(result).not.toHaveProperty('password');
  });

  it('rejects duplicate email during signup', () => {
    usersService.findByEmail.mockReturnValue(existingUser);

    expect(() =>
      service.signup({
        username: 'Another User',
        email: 'EXISTING@example.com',
        password: 'password123',
      }),
    ).toThrow(ConflictException);

    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('authenticates a persisted user and signs the persisted identity into the JWT', async () => {
    usersService.findByEmail.mockReturnValue(existingUser);

    const result = await service.login({
      email: ' EXISTING@example.com ',
      password: 'password123',
    });

    expect(usersService.findByEmail).toHaveBeenCalledWith('existing@example.com');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: existingUser.id,
      email: existingUser.email,
    });
    expect(result).toEqual({
      message: 'Login successful',
      email: existingUser.email,
      accessToken: 'test-token',
    });
  });

  it('rejects an unknown login email', async () => {
    usersService.findByEmail.mockReturnValue(undefined);

    await expect(
      service.login({ email: 'missing@example.com', password: 'password123' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects an invalid password', async () => {
    usersService.findByEmail.mockReturnValue(existingUser);

    await expect(
      service.login({ email: existingUser.email, password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('does not authenticate the former hardcoded admin when it is not persisted', async () => {
    usersService.findByEmail.mockReturnValue(undefined);

    await expect(
      service.login({ email: 'admin@test.com', password: 'password123' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
