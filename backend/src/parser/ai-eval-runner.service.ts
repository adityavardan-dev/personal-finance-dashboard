/** Runs DEV-only captured-response evaluations and records the score. */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EvalCaseResult, evaluateCapturedCase } from './ai-eval-runner';

const DEV_PROJECT_REF = 'vimkmhiywepwxruethqo';
const EVALUATOR_VERSION = 'captured-subset-v1';

interface StoredEvalCase {
  id: string;
  expected_json: unknown;
  observed_json: unknown;
}

export interface EvalRunSummary {
  id: string;
  runKind: 'CAPTURED_BASELINE';
  evaluatorVersion: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  casePassRate: number;
  totalFieldChecks: number;
  passedFieldChecks: number;
  fieldPassRate: number;
  results: EvalCaseResult[];
}

@Injectable()
export class AiEvalRunnerService {
  constructor(private readonly supabase: SupabaseService) {}

  async runCapturedBaseline(accessToken: string): Promise<EvalRunSummary> {
    this.assertDevelopmentProject();
    const cases = await this.supabase.data<StoredEvalCase[]>(
      accessToken,
      'ai_eval_cases?review_status=eq.READY&expected_json=not.is.null&select=id,expected_json,observed_json&order=created_at.asc',
    );
    const results = cases.map((item) =>
      evaluateCapturedCase(item.id, item.expected_json, item.observed_json),
    );
    if (results.length === 0) {
      throw new BadRequestException(
        'No READY evaluation cases have structured expected JSON.',
      );
    }
    const totalCases = results.length;
    const passedCases = results.filter((result) => result.passed).length;
    const totalFieldChecks = results.reduce(
      (sum, result) => sum + result.totalFieldChecks,
      0,
    );
    const passedFieldChecks = results.reduce(
      (sum, result) => sum + result.passedFieldChecks,
      0,
    );
    const casePassRate = this.percent(passedCases, totalCases);
    const fieldPassRate = this.percent(passedFieldChecks, totalFieldChecks);

    const rows = await this.supabase.data<Array<{ id: string }>>(
      accessToken,
      'ai_eval_runs?select=id',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          run_kind: 'CAPTURED_BASELINE',
          evaluator_version: EVALUATOR_VERSION,
          total_cases: totalCases,
          passed_cases: passedCases,
          failed_cases: totalCases - passedCases,
          case_pass_rate: casePassRate,
          total_field_checks: totalFieldChecks,
          passed_field_checks: passedFieldChecks,
          field_pass_rate: fieldPassRate,
          results_json: results,
        }),
      },
    );

    return {
      id: rows[0].id,
      runKind: 'CAPTURED_BASELINE',
      evaluatorVersion: EVALUATOR_VERSION,
      totalCases,
      passedCases,
      failedCases: totalCases - passedCases,
      casePassRate,
      totalFieldChecks,
      passedFieldChecks,
      fieldPassRate,
      results,
    };
  }

  private assertDevelopmentProject(): void {
    const projectUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
    if (
      process.env.APP_ENV !== 'development' ||
      projectUrl !== `https://${DEV_PROJECT_REF}.supabase.co` ||
      process.env.SUPABASE_PROJECT_ID?.trim() !== DEV_PROJECT_REF
    ) {
      throw new ForbiddenException(
        'Evaluations are available only in XPENSE Development.',
      );
    }
  }

  private percent(numerator: number, denominator: number): number {
    return denominator === 0
      ? 0
      : Number(((numerator / denominator) * 100).toFixed(2));
  }
}
