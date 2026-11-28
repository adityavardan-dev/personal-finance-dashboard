import { ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiEvalRunnerService } from './ai-eval-runner.service';

describe('AiEvalRunnerService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.APP_ENV = 'development';
    process.env.SUPABASE_URL = 'https://vimkmhiywepwxruethqo.supabase.co';
    process.env.SUPABASE_PROJECT_ID = 'vimkmhiywepwxruethqo';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('records both strict case accuracy and expected-field accuracy', async () => {
    const data = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'case-1',
          expected_json: {
            splitDrafts: [
              { ordinal: 1, amountMinor: 50000, date: '2026-11-25' },
            ],
          },
          observed_json: {
            after: {
              pendingSplits: [{ ordinal: 1, amountMinor: 50000, date: null }],
            },
          },
        },
      ])
      .mockResolvedValueOnce([{ id: 'run-1' }]);
    const service = new AiEvalRunnerService({
      data,
    } as unknown as SupabaseService);

    const result = await service.runCapturedBaseline('user-token');

    expect(result).toMatchObject({
      id: 'run-1',
      totalCases: 1,
      passedCases: 0,
      failedCases: 1,
      casePassRate: 0,
      totalFieldChecks: 3,
      passedFieldChecks: 2,
      fieldPassRate: 66.67,
    });
    expect(data).toHaveBeenNthCalledWith(
      2,
      'user-token',
      'ai_eval_runs?select=id',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = data.mock.calls[1][2] as { body: string };
    expect(JSON.parse(request.body)).toMatchObject({
      run_kind: 'CAPTURED_BASELINE',
      evaluator_version: 'captured-subset-v1',
      passed_cases: 0,
      field_pass_rate: 66.67,
    });
  });

  it('refuses to run outside the development project', async () => {
    process.env.APP_ENV = 'production';
    const data = jest.fn();
    const service = new AiEvalRunnerService({
      data,
    } as unknown as SupabaseService);

    await expect(
      service.runCapturedBaseline('user-token'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(data).not.toHaveBeenCalled();
  });
});
