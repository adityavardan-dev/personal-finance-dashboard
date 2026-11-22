/**
 * Purpose: Tests the behavior of the related backend feature.
 */
import { CloudflareIntentSegmenter } from './cloudflare-intent-segmenter';

describe('CloudflareIntentSegmenter', () => {
  const originalAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const originalApiToken = process.env.CLOUDFLARE_AI_API_TOKEN;
  const originalModel = process.env.CLOUDFLARE_AI_MODEL;

  afterEach(() => {
    jest.restoreAllMocks();
    restoreEnv('CLOUDFLARE_ACCOUNT_ID', originalAccountId);
    restoreEnv('CLOUDFLARE_AI_API_TOKEN', originalApiToken);
    restoreEnv('CLOUDFLARE_AI_MODEL', originalModel);
  });

  it('requests structured segments from hosted Gemma' /** Checks that requests structured segments from hosted Gemma. */, async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-id';
    process.env.CLOUDFLARE_AI_API_TOKEN = 'secret-token';
    delete process.env.CLOUDFLARE_AI_MODEL;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  segments: ['spent ₹200 on tea', 'spent ₹300 on bus'],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const segmenter = new CloudflareIntentSegmenter();

    const segments = await segmenter.segment(
      'spent ₹200 on tea spent ₹300 on bus',
    );

    expect(segmenter.isConfigured()).toBe(true);
    expect(segments).toEqual(['spent ₹200 on tea', 'spent ₹300 on bus']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-id/ai/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const requestBody = fetchMock.mock.calls[0][1]?.body;
    expect(typeof requestBody).toBe('string');
    if (typeof requestBody !== 'string')
      throw new Error('Missing request body');
    const request = JSON.parse(requestBody) as {
      model: string;
      response_format: { type: string; json_schema: { type: string } };
      messages: Array<{ role: string; content: string }>;
    };
    expect(request).toMatchObject({
      model: '@cf/google/gemma-4-26b-a4b-it',
      response_format: {
        type: 'json_schema',
        json_schema: { type: 'object' },
      },
    });
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer secret-token' }),
    );
    expect(request.messages[0].content).toContain('You are PENNY');
    expect(request.messages[0].content).toContain('You extract transaction boundaries');
  });

  it('uses the local parser when Cloudflare is not configured' /** Checks that uses the local parser when Cloudflare is not configured. */, async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_AI_API_TOKEN;
    const fetchMock = jest.spyOn(global, 'fetch');
    const segmenter = new CloudflareIntentSegmenter();

    expect(segmenter.isConfigured()).toBe(false);
    expect(await segmenter.segment('spent ₹200 on tea')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/** Provides restore env. */
function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
