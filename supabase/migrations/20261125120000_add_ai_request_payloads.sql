-- Keep the user input and provider output beside each model-call metric for later review.
alter table public.ai_request_metrics
  add column query_json jsonb,
  add column response_json jsonb;

comment on column public.ai_request_metrics.query_json is
  'User message and supplied draft context for this model call; null for older rows.';
comment on column public.ai_request_metrics.response_json is
  'Cloudflare response envelope when JSON was received; null for older rows or unavailable responses.';

comment on table public.ai_request_metrics is
  'User-scoped model-call metrics with input context and provider response for quality review.';
