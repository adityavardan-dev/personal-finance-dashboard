import type { SupabaseService } from '../supabase/supabase.service';
import { AiMetricsService } from './ai-metrics.service';

describe('AiMetricsService', () => {
  it('persists provider usage under the authenticated user token', async () => {
    const supabase = {
      data: jest.fn().mockResolvedValue(null),
    } as unknown as SupabaseService;
    const service = new AiMetricsService(supabase);

    await service.record('user-access-token', {
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

    expect(supabase.data).toHaveBeenCalledWith(
      'user-access-token',
      'ai_request_metrics',
      expect.objectContaining({ method: 'POST' }),
    );
    const init = (supabase.data as jest.Mock).mock.calls[0][2] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      conversation_id: '11111111-1111-4111-8111-111111111111',
      request_id: '22222222-2222-4222-8222-222222222222',
      temperature: 0.3,
      max_completion_tokens: 1024,
      input_tokens: 321,
      output_tokens: 45,
      total_tokens: 366,
      usage_reported: true,
    });
  });

  it('does not attempt a write without an access token or request trace', async () => {
    const supabase = { data: jest.fn() } as unknown as SupabaseService;
    const service = new AiMetricsService(supabase);
    await service.record(undefined, {
      route: 'split-intent',
      model: '@cf/google/gemma-4-26b-a4b-it',
      outcome: 'HTTP_ERROR',
    });
    expect(supabase.data).not.toHaveBeenCalled();
  });
});
