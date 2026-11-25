/** Saves opt-in conversation failures only in the XPENSE Development project. */
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAiEvalCaseDto } from './dto/create-ai-eval-case.dto';

const DEV_PROJECT_REF = 'vimkmhiywepwxruethqo';

@Injectable()
export class AiEvalCasesService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(accessToken: string, input: CreateAiEvalCaseDto): Promise<{ id: string }> {
    const projectUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
    if (process.env.APP_ENV !== 'development' ||
      projectUrl !== `https://${DEV_PROJECT_REF}.supabase.co` ||
      process.env.SUPABASE_PROJECT_ID?.trim() !== DEV_PROJECT_REF) {
      throw new ForbiddenException('Test cases are available only in XPENSE Development.');
    }
    if (!input.expectedDescription.trim() ||
      JSON.stringify(input.input).length > 30000 || JSON.stringify(input.observed).length > 30000) {
      throw new BadRequestException('A Penny reply and a short expected result are required.');
    }
    const aiRequests = await this.supabase.data<Array<Record<string, unknown>>>(
      accessToken,
      `ai_request_metrics?request_id=eq.${encodeURIComponent(input.requestId)}&select=route,provider,model,temperature,max_completion_tokens,input_tokens,output_tokens,total_tokens,outcome,http_status,usage_reported,query_json,response_json,created_at&order=created_at.asc`,
    );
    const rows = await this.supabase.data<Array<{ id: string }>>(accessToken, 'ai_eval_cases?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        source_conversation_id: input.conversationId,
        source_request_id: input.requestId,
        source_response_id: input.responseId,
        input_json: input.input,
        observed_json: { ...input.observed, aiRequests },
        expected_description: input.expectedDescription.trim(),
      }),
    });
    return { id: rows[0].id };
  }
}
