import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../auth/auth';
import {
  ContextIntakeSessionService,
  INTAKE_SESSION_TTL_MS,
} from './context-intake-session.service';

describe('ContextIntakeSessionService', () => {
  let service: ContextIntakeSessionService;

  beforeEach(() => {
    sessionStorage.clear();
    const payload = btoa(JSON.stringify({ sub: 42 }));
    TestBed.configureTestingModule({
      providers: [
        ContextIntakeSessionService,
        {
          provide: AuthService,
          useValue: { getAccessToken: () => `header.${payload}.signature` },
        },
      ],
    });
    service = TestBed.inject(ContextIntakeSessionService);
  });

  afterEach(() => sessionStorage.clear());

  it('stores and restores a user-scoped conversation', () => {
    service.save('conversation-one', { drafts: [1, 2] });

    expect(service.load<{ drafts: number[] }>()?.value.drafts).toEqual([1, 2]);
    expect(sessionStorage.getItem('xpense:intake:index:42')).toBe('conversation-one');
  });

  it('uses a thirty-minute inactivity window', () => {
    const cached = service.save('conversation-two', {});

    expect(Date.parse(cached!.expiresAt) - Date.parse(cached!.lastActivityAt)).toBe(
      INTAKE_SESSION_TTL_MS,
    );
  });

  it('removes the current conversation', () => {
    service.save('conversation-three', { private: true });
    service.clear();

    expect(service.load()).toBeNull();
    expect(sessionStorage.getItem('xpense:intake:index:42')).toBeNull();
  });
});
