-- Apply only to the XPENSE Development Supabase project.
-- Immutable summaries produced by the captured-response or future live-replay evaluators.
create table public.ai_eval_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  run_kind text not null check (run_kind in ('CAPTURED_BASELINE', 'LIVE_REPLAY')),
  evaluator_version text not null check (char_length(btrim(evaluator_version)) between 1 and 80),
  total_cases integer not null check (total_cases > 0),
  passed_cases integer not null check (passed_cases between 0 and total_cases),
  failed_cases integer not null check (failed_cases = total_cases - passed_cases),
  case_pass_rate numeric(5,2) not null check (case_pass_rate between 0 and 100),
  total_field_checks integer not null check (total_field_checks > 0),
  passed_field_checks integer not null check (passed_field_checks between 0 and total_field_checks),
  field_pass_rate numeric(5,2) not null check (field_pass_rate between 0 and 100),
  results_json jsonb not null check (jsonb_typeof(results_json) = 'array'),
  created_at timestamptz not null default now()
);

create index ai_eval_runs_user_created_idx
  on public.ai_eval_runs (user_id, created_at desc);

alter table public.ai_eval_runs enable row level security;
revoke all on table public.ai_eval_runs from anon, authenticated;
grant select, insert on table public.ai_eval_runs to authenticated;

create policy ai_eval_runs_select_own on public.ai_eval_runs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_eval_runs_insert_own on public.ai_eval_runs
  for insert to authenticated with check ((select auth.uid()) = user_id);
