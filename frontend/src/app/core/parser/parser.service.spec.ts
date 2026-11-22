import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ParserService } from './parser.service';

const trace = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
};

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
    service.parse('Lunch INR 200 today', trace).subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/parser/parse'));
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('X-Conversation-Id')).toBe(trace.conversationId);
    expect(request.request.headers.get('X-Request-Id')).toBe(trace.requestId);
    expect(request.request.body).toEqual({
      text: 'Lunch INR 200 today',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referenceTimestamp: expect.any(String),
    });
    request.flush({ status: 'READY', draft: {}, missingFields: [] });
  });

  it('posts multi-transaction text to the batch parser endpoint', () => {
    service.parseBatch('spent 350 on food and spent 500 on petrol today', trace).subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/parser/parse-batch'));
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('X-Conversation-Id')).toBe(trace.conversationId);
    expect(request.request.headers.get('X-Request-Id')).toBe(trace.requestId);
    expect(request.request.body.text).toContain('spent 350');
    request.flush({ status: 'READY', drafts: [] });
  });
});
