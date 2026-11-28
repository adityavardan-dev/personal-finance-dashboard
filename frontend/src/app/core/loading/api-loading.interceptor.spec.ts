import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiLoadingStore } from './api-loading.store';
import { apiLoadingInterceptor } from './api-loading.interceptor';

describe('apiLoadingInterceptor', () => {
  it('keeps loading visible until all overlapping requests finish, including errors', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiLoadingInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const client = TestBed.inject(HttpClient);
    const requests = TestBed.inject(HttpTestingController);
    const loading = TestBed.inject(ApiLoadingStore);

    client.get('/api/one').subscribe();
    client.get('/api/two').subscribe({ error: () => undefined });
    expect(loading.loading()).toBe(true);

    requests.expectOne('/api/one').flush({});
    expect(loading.loading()).toBe(true);
    requests.expectOne('/api/two').flush({}, { status: 500, statusText: 'Error' });
    expect(loading.loading()).toBe(false);
    requests.verify();
  });
});
