import type { LoggerService } from '@nestjs/common';
import { logCloudflareUsage, readCloudflareUsage } from './cloudflare-usage';

describe('Cloudflare usage monitoring', () => {
  it('records provider token counts with the request trace', () => {
    const logger = { log: jest.fn() } as unknown as LoggerService;

    logCloudflareUsage(logger, {
      trace: {
        conversationId: '11111111-1111-4111-8111-111111111111',
        requestId: '22222222-2222-4222-8222-222222222222',
      },
      route: 'split-intent',
      model: '@cf/google/gemma-4-26b-a4b-it',
      outcome: 'SUCCESS',
      httpStatus: 200,
      envelope: {
        usage: {
          prompt_tokens: 321,
          completion_tokens: 45,
          total_tokens: 366,
        },
      },
    });

    const event = JSON.parse(
      String((logger.log as jest.Mock).mock.calls[0][0]),
    );
    expect(event).toMatchObject({
      event: 'cloudflare-ai-usage',
      requestId: '22222222-2222-4222-8222-222222222222',
      route: 'split-intent',
      inputTokens: 321,
      outputTokens: 45,
      totalTokens: 366,
      usageReported: true,
    });
  });

  it('rejects missing or malformed usage counters', () => {
    expect(readCloudflareUsage({ usage: { prompt_tokens: 10 } })).toBeNull();
    expect(
      readCloudflareUsage({
        usage: {
          prompt_tokens: -1,
          completion_tokens: 5,
          total_tokens: 4,
        },
      }),
    ).toBeNull();
  });
});
