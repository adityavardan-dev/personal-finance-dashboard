/** Verifies the small HTTP adapter used for Supabase Auth and Data API calls. */
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  let service: SupabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new SupabaseService();
  });

  afterAll(() => {
    process.env.SUPABASE_URL = originalUrl;
    process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
    global.fetch = originalFetch;
  });

  it('normalizes the raw top-level user returned by the signup HTTP endpoint', async () => {
    fetchMock.mockResolvedValue(response({ id: 'user-1', email: 'user@example.com' }));

    await expect(service.signUp('User', 'user@example.com', 'password123')).resolves.toEqual({
      user: { id: 'user-1', email: 'user@example.com' },
    });
  });

  it('also accepts an SDK-shaped signup response', async () => {
    fetchMock.mockResolvedValue(response({ user: { id: 'user-1' } }));

    await expect(service.signUp('User', 'user@example.com', 'password123')).resolves.toEqual({
      user: { id: 'user-1' },
    });
  });
});

function response(body: unknown): Pick<Response, 'ok' | 'status' | 'text'> {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  };
}
