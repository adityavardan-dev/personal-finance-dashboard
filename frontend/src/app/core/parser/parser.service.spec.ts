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

  it('posts split intent text with the conversation and request IDs', () => {
    service.interpretSplit('share 4000 across 5 people', trace).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/parser/split-intent'));
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('X-Conversation-Id')).toBe(trace.conversationId);
    expect(request.request.headers.get('X-Request-Id')).toBe(trace.requestId);
    request.flush({
      drafts: [],
      modelAttempted: false,
      modelAccepted: false,
      interpretationSource: 'LOCAL',
    });
  });

  it('posts current split state for participant follow-ups', () => {
    service.interpretSplitFollowUp('Use A and B for split 1', [
      { id: 'one', ordinal: 1, amountMinor: 50000, peopleCount: 2, currency: 'INR', date: null, names: '', paidBy: '' },
    ], trace).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/parser/split-follow-up'));
    expect(request.request.headers.get('X-Conversation-Id')).toBe(trace.conversationId);
    expect(request.request.headers.get('X-Request-Id')).toBe(trace.requestId);
    expect(request.request.body).toEqual({ text: 'Use A and B for split 1', pendingSplits: [{ ordinal: 1, peopleCount: 2, amountMinor: 50000, names: [], paidBy: '' }] });
    request.flush({ updates: [] });
  });

  it('posts current personal draft summaries for an unresolved follow-up', () => {
    service.interpretPersonalFollowUp('Move the cafe one to 420', [{ amount: '350', category: 'Food & Dining', merchant: 'Cafe', date: '2026-11-22', note: 'coffee', splitResolution: 'personal', splitFactor: '' }], trace).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/parser/personal-follow-up'));
    expect(request.request.headers.get('X-Conversation-Id')).toBe(trace.conversationId);
    expect(request.request.headers.get('X-Request-Id')).toBe(trace.requestId);
    expect(request.request.body.drafts).toEqual([{ ordinal: 1, amount: 350, category: 'Food & Dining', merchant: 'Cafe', date: '2026-11-22', note: 'coffee', splitResolution: 'personal', splitFactor: null }]);
    request.flush({ updates: [] });
  });
});
