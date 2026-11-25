-- Apply only to the XPENSE Development Supabase project.
-- User-approved examples of conversation turns for future Penny evaluations.
create table public.ai_eval_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  source_conversation_id uuid not null,
  source_request_id uuid not null,
  source_response_id uuid not null,
  input_json jsonb not null,
  observed_json jsonb not null,
  expected_description text not null check (char_length(btrim(expected_description)) between 1 and 2000),
  expected_json jsonb,
  review_status text not null default 'NEEDS_STRUCTURED_EXPECTATION'
    check (review_status in ('NEEDS_STRUCTURED_EXPECTATION', 'READY')),
  created_at timestamptz not null default now(),
  unique (user_id, source_response_id)
);

comment on table public.ai_eval_cases is
  'Opt-in DEV conversation examples; expected_description is human-approved and expected_json is reserved for machine grading.';

create index ai_eval_cases_user_created_idx
  on public.ai_eval_cases (user_id, created_at desc);

alter table public.ai_eval_cases enable row level security;
revoke all on table public.ai_eval_cases from anon, authenticated;
grant select, insert, update on table public.ai_eval_cases to authenticated;

create policy ai_eval_cases_select_own on public.ai_eval_cases
  for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_eval_cases_insert_own on public.ai_eval_cases
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ai_eval_cases_update_own on public.ai_eval_cases
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
