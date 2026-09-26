import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService; let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); service = TestBed.inject(ProfileService); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('gets the current profile', () => { service.getMine().subscribe(); const request = http.expectOne((req) => req.url.endsWith('/users/me')); expect(request.request.method).toBe('GET'); request.flush({ id: 1, username: 'River Stone', email: 'river@example.com', preferences: { currency: 'INR', theme: 'system' } }); });
  it('updates currency preference', () => { service.updatePreferences({ currency: 'USD' }).subscribe(); const request = http.expectOne((req) => req.url.endsWith('/users/me/preferences')); expect(request.request.method).toBe('PUT'); expect(request.request.body).toEqual({ currency: 'USD' }); request.flush({ preferences: { currency: 'USD', theme: 'system' } }); });
});
