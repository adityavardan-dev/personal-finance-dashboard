-- Stores provider-reported AI usage for cost, capacity, and quality analysis.
-- Prompt and response content are deliberately excluded from this table.
create table public.ai_request_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  conversation_id uuid not null,
  request_id uuid not null,
  route text not null check (route in (
    'parse-batch-segmentation',
    'personal-follow-up',
    'split-intent',
    'split-follow-up'
  )),
  provider text not null default 'cloudflare' check (provider = 'cloudflare'),
  model text not null check (char_length(btrim(model)) between 1 and 200),
  temperature numeric(3, 2) not null check (temperature between 0 and 2),
  max_completion_tokens integer not null check (max_completion_tokens > 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  outcome text not null check (outcome in (
    'SUCCESS',
    'HTTP_ERROR',
    'NETWORK_OR_RESPONSE_ERROR'
  )),
  http_status smallint check (http_status is null or http_status between 100 and 599),
  usage_reported boolean not null,
  created_at timestamptz not null default now(),
  check (
    (usage_reported and input_tokens is not null and output_tokens is not null and total_tokens is not null)
    or
    (not usage_reported and input_tokens is null and output_tokens is null and total_tokens is null)
  )
);

comment on table public.ai_request_metrics is
  'Per-model-call token and generation settings correlated by conversation and request IDs.';

create index ai_request_metrics_user_conversation_created_idx
  on public.ai_request_metrics (user_id, conversation_id, created_at desc);
create index ai_request_metrics_user_request_idx
  on public.ai_request_metrics (user_id, request_id);

alter table public.ai_request_metrics enable row level security;

revoke all on table public.ai_request_metrics from anon, authenticated;
grant select, insert on table public.ai_request_metrics to authenticated;

create policy ai_request_metrics_select_own
on public.ai_request_metrics for select
to authenticated
using ((select auth.uid()) = user_id);

create policy ai_request_metrics_insert_own
on public.ai_request_metrics for insert
to authenticated
with check ((select auth.uid()) = user_id);
