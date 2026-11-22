/**
 * Purpose: Tests the behavior of the related backend feature.
 */
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrencyCode } from '../budgets/currency-code';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: { getPublicProfile: jest.Mock; updatePreferences: jest.Mock };

  beforeEach(async () => {
    service = { getPublicProfile: jest.fn(), updatePreferences: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(UsersController);
  });

  it('gets profile using JWT user identity' /** Checks that gets profile using JWT user identity. */, () => {
    controller.getMine({ user: { userId: 'user-42', accessToken: 'token-42' } } as any);
    expect(service.getPublicProfile).toHaveBeenCalledWith('user-42', 'token-42');
  });

  it('updates preferences using JWT user identity' /** Checks that updates preferences using JWT user identity. */, () => {
    controller.updatePreferences({ user: { userId: 'user-42', accessToken: 'token-42' } } as any, {
      currency: CurrencyCode.EUR,
    });
    expect(service.updatePreferences).toHaveBeenCalledWith(
      'user-42',
      'token-42',
      CurrencyCode.EUR,
    );
  });

  it('is protected at controller level' /** Checks that is protected at controller level. */, () => {
    const guards: any[] =
      Reflect.getMetadata('__guards__', UsersController) ?? [];
    expect(guards).toContain(JwtAuthGuard);
  });
});
