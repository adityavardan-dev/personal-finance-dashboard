import { CloudflareStructuredModelProvider } from './cloudflare-structured-model.provider';

describe('CloudflareStructuredModelProvider', () => {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AI_API_TOKEN;

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account';
    process.env.CLOUDFLARE_AI_API_TOKEN = 'token';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restore('CLOUDFLARE_ACCOUNT_ID', account);
    restore('CLOUDFLARE_AI_API_TOKEN', token);
  });

  it('returns parsed structured content', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"answer":42}' } }],
        }),
        { status: 200 },
      ),
    );

    const result =
      await new CloudflareStructuredModelProvider().generateStructured<{
        answer: number;
      }>({
        messages: [{ role: 'user', content: 'question' }],
        responseSchema: { type: 'object' },
        temperature: 0.3,
        maxCompletionTokens: 100,
      });

    expect(result).toEqual({ status: 'SUCCESS', value: { answer: 42 } });
  });

  it.each([408, 429, 500])(
    'classifies HTTP %s as unavailable',
    async (status) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('{}', { status }));
      const result =
        await new CloudflareStructuredModelProvider().generateStructured({
          messages: [{ role: 'user', content: 'question' }],
          responseSchema: { type: 'object' },
          temperature: 0.3,
          maxCompletionTokens: 100,
        });
      expect(result.status).toBe('UNAVAILABLE');
    },
  );

  it('classifies malformed model JSON as invalid', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'not-json' } }] }),
        {
          status: 200,
        },
      ),
    );
    const result =
      await new CloudflareStructuredModelProvider().generateStructured({
        messages: [{ role: 'user', content: 'question' }],
        responseSchema: { type: 'object' },
        temperature: 0.3,
        maxCompletionTokens: 100,
      });
    expect(result.status).toBe('INVALID_RESPONSE');
  });
});

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
