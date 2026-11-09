import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ParserService } from './parser.service';

describe('ParserService', () => {
  let service: ParserService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ParserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts raw text to the authenticated parser endpoint', () => {
    service.parse('Lunch INR 200 today').subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/parser/parse'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      text: 'Lunch INR 200 today',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referenceTimestamp: expect.any(String),
    });
    request.flush({ status: 'READY', draft: {}, missingFields: [] });
  });

  it('posts multi-transaction text to the batch parser endpoint', () => {
    service.parseBatch('spent 350 on food and spent 500 on petrol today').subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/parser/parse-batch'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body.text).toContain('spent 350');
    request.flush({ status: 'READY', drafts: [] });
  });
});
