import { CloudflareSplitInterpreter } from './cloudflare-split-interpreter';
import { CloudflareStructuredModelProvider } from '@adityavardan/provider-cloudflare';

const originalAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
const originalToken = process.env.CLOUDFLARE_AI_API_TOKEN;

describe('CloudflareSplitInterpreter PENNY prompts', () => {
  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'account-id';
    process.env.CLOUDFLARE_AI_API_TOKEN = 'test-token';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalAccount === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
    else process.env.CLOUDFLARE_ACCOUNT_ID = originalAccount;
    if (originalToken === undefined) delete process.env.CLOUDFLARE_AI_API_TOKEN;
    else process.env.CLOUDFLARE_AI_API_TOKEN = originalToken;
  });

  it('includes docs guidance in split intent and split follow-up requests', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"drafts":[]}' } }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"updates":[]}' } }],
          }),
          { status: 200 },
        ),
      );
    const interpreter = new CloudflareSplitInterpreter(
      undefined,
      new CloudflareStructuredModelProvider({
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
        apiToken: process.env.CLOUDFLARE_AI_API_TOKEN ?? '',
      }),
    );
    await interpreter.interpret('Share 4000 across 5 people');
    await interpreter.interpretFollowUp('Use Harsha and You for split 1', [
      { ordinal: 1, peopleCount: 2 },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const request = JSON.parse(String(call[1]?.body)) as {
        messages: Array<{ role: string; content: string }>;
      };
      expect(request.messages[0]).toMatchObject({
        role: 'system',
        content: expect.stringContaining('You are PENNY'),
      });
      expect(request.messages[0].content).not.toContain(
        'Run the relevant backend Jest tests',
      );
      expect(request.messages[1].role).toBe('system');
    }
  });
});
