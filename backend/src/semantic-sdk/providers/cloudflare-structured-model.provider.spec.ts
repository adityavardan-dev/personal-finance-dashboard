import { CloudflareStructuredModelProvider } from '@adityavardan/provider-cloudflare';

describe('CloudflareStructuredModelProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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

    const result = await provider().generateStructured<{
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
      const result = await provider().generateStructured({
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
    const result = await provider().generateStructured({
      messages: [{ role: 'user', content: 'question' }],
      responseSchema: { type: 'object' },
      temperature: 0.3,
      maxCompletionTokens: 100,
    });
    expect(result.status).toBe('INVALID_RESPONSE');
  });
});

function provider(): CloudflareStructuredModelProvider {
  return new CloudflareStructuredModelProvider({
    accountId: 'account',
    apiToken: 'token',
  });
}
