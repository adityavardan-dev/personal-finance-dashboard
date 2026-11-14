import { HttpClient } from '@angular/common/http';
import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth';
import { PeerSplitsService } from './peer-splits.service';

describe('PeerSplitsService dates', () => {
  it('keeps an edited example date in the browser session', () => {
    const key = 'xpense:split:anonymous';
    sessionStorage.removeItem(key);
    TestBed.configureTestingModule({
      providers: [
        PeerSplitsService,
        { provide: HttpClient, useValue: {} },
        { provide: AuthService, useValue: { sessionVersion: signal(0), getAccessToken: () => null } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const service = TestBed.inject(PeerSplitsService);
    expect(service.updateDate('example-bowling', '2026-11-13')).toBe(true);
    expect(service.getGroup('example-bowling')?.date).toBe('2026-11-13');
    expect(JSON.parse(sessionStorage.getItem(key) ?? '{}').exampleDates['example-bowling']).toBe('2026-11-13');
    expect(service.updateDate('example-bowling', '2026-02-30')).toBe(false);

    sessionStorage.removeItem(key);
  });
});
