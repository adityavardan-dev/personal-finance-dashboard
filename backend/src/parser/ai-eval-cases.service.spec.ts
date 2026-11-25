import { AiEvalCasesService } from './ai-eval-cases.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { CreateAiEvalCaseDto } from './dto/create-ai-eval-case.dto';

describe('AiEvalCasesService', () => {
  const oldEnv = {
    app: process.env.APP_ENV,
    url: process.env.SUPABASE_URL,
    id: process.env.SUPABASE_PROJECT_ID,
  };
  const input: CreateAiEvalCaseDto = {
    conversationId: '11111111-1111-4111-8111-111111111111',
    requestId: '22222222-2222-4222-8222-222222222222',
    responseId: '33333333-3333-4333-8333-333333333333',
    modelAttempted: false,
    input: { message: 'Dinner split and coffee', before: { personalDrafts: [] } },
    observed: { reply: 'Split preview ready', after: { personalDrafts: [] } },
    expectedDescription: 'Keep the split and add a personal coffee draft.',
  };

  afterEach(() => {
    process.env.APP_ENV = oldEnv.app;
    process.env.SUPABASE_URL = oldEnv.url;
    process.env.SUPABASE_PROJECT_ID = oldEnv.id;
  });

  it('saves an opt-in case through the caller token only in the development project', async () => {
    process.env.APP_ENV = 'development';
    process.env.SUPABASE_URL = 'https://vimkmhiywepwxruethqo.supabase.co';
    process.env.SUPABASE_PROJECT_ID = 'vimkmhiywepwxruethqo';
    const data = jest.fn()
      .mockResolvedValueOnce([{ route: 'split-intent', response_json: { choices: [] } }])
      .mockResolvedValueOnce([{ id: 'case-id' }]);
    const service = new AiEvalCasesService({ data } as unknown as SupabaseService);

    expect(await service.create('user-token', input)).toEqual({ id: 'case-id' });
    expect(data).toHaveBeenNthCalledWith(2, 'user-token', 'ai_eval_cases?select=id', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('Dinner split and coffee'),
    }));
    const body = JSON.parse(data.mock.calls[1][2].body);
    expect(body).toMatchObject({
      source_request_id: input.requestId,
      source_response_id: input.responseId,
      expected_description: input.expectedDescription,
      observed_json: expect.objectContaining({
        aiRequests: [{ route: 'split-intent', response_json: { choices: [] } }],
      }),
    });
    expect(body).not.toHaveProperty('user_id');
  });

  it('refuses to write when the backend points at production', async () => {
    process.env.APP_ENV = 'development';
    process.env.SUPABASE_URL = 'https://axdjyebrkuagonksrvrw.supabase.co';
    process.env.SUPABASE_PROJECT_ID = 'axdjyebrkuagonksrvrw';
    const data = jest.fn();
    const service = new AiEvalCasesService({ data } as unknown as SupabaseService);

    await expect(service.create('user-token', input)).rejects.toThrow('only in XPENSE Development');
    expect(data).not.toHaveBeenCalled();
  });

  it('accepts a user-flagged response even when the model was attempted', async () => {
    process.env.APP_ENV = 'development';
    process.env.SUPABASE_URL = 'https://vimkmhiywepwxruethqo.supabase.co';
    process.env.SUPABASE_PROJECT_ID = 'vimkmhiywepwxruethqo';
    const data = jest.fn()
      .mockResolvedValueOnce([{ route: 'parse-batch-segmentation', response_json: { choices: [] } }])
      .mockResolvedValueOnce([{ id: 'ai-case' }]);
    const service = new AiEvalCasesService({ data } as unknown as SupabaseService);

    await expect(service.create('user-token', {
      ...input,
      modelAttempted: true,
      observed: { modelAttempted: true, modelAccepted: false, response: { drafts: [] } },
    })).resolves.toEqual({ id: 'ai-case' });
  });
});
