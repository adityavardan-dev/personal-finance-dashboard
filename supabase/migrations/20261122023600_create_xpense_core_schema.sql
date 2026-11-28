-- XPENSE production schema. Financial values use integer minor units and every
-- app table is protected by Supabase Auth row-level security.
create schema if not exists xpense_private;

create type public.transaction_type as enum ('expense', 'income');
create type public.split_status as enum ('draft', 'confirmed', 'cancelled');
create type public.conversation_mode as enum ('personal', 'split', 'mixed');
create type public.conversation_role as enum ('user', 'assistant');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(btrim(username)) between 1 and 80),
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_lower_unique on public.profiles (lower(email));

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  monthly_limit_minor bigint check (monthly_limit_minor is null or monthly_limit_minor >= 0),
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_category_limits (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category text not null check (char_length(btrim(category)) between 1 and 80),
  limit_minor bigint not null check (limit_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, category)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.transaction_type not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('INR', 'USD', 'EUR')),
  category text not null check (char_length(btrim(category)) between 1 and 80),
  merchant text not null default '' check (char_length(merchant) <= 200),
  transaction_date date not null,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_user_date_idx on public.expenses (user_id, transaction_date desc);
create index expenses_user_category_idx on public.expenses (user_id, category);

create table public.peer_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  total_amount_minor bigint not null check (total_amount_minor > 0),
  currency text not null check (currency in ('INR', 'USD', 'EUR')),
  expense_date date not null,
  status public.split_status not null default 'draft',
  source_expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index peer_splits_user_date_idx on public.peer_splits (user_id, expense_date desc);

create table public.peer_split_participants (
  id uuid primary key default gen_random_uuid(),
  split_id uuid not null references public.peer_splits(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  linked_user_id uuid references public.profiles(id) on delete set null,
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  amount_owed_minor bigint not null default 0 check (amount_owed_minor >= 0),
  created_at timestamptz not null default now()
);
create index peer_split_participants_split_idx on public.peer_split_participants (split_id);

create table public.peer_split_obligations (
  id uuid primary key default gen_random_uuid(),
  split_id uuid not null references public.peer_splits(id) on delete cascade,
  from_participant_id uuid not null references public.peer_split_participants(id) on delete cascade,
  to_participant_id uuid not null references public.peer_split_participants(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now(),
  check (from_participant_id <> to_participant_id)
);
create index peer_split_obligations_split_idx on public.peer_split_obligations (split_id);

create table public.conversation_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode public.conversation_mode not null default 'personal',
  draft_state jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_state) = 'object'),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (expires_at > last_activity_at)
);
create index conversation_sessions_user_expiry_idx on public.conversation_sessions (user_id, expires_at desc);

create table public.conversation_turns (
  request_id uuid primary key,
  conversation_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.conversation_role not null,
  message text not null check (char_length(message) between 1 and 4000),
  structured_result jsonb check (structured_result is null or jsonb_typeof(structured_result) = 'object'),
  interpretation_source text check (interpretation_source is null or interpretation_source in ('LOCAL', 'MODEL')),
  model_attempted boolean not null default false,
  model_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.conversation_sessions(id, user_id) on delete cascade
);
create index conversation_turns_conversation_created_idx on public.conversation_turns (conversation_id, created_at);

create or replace function xpense_private.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function xpense_private.set_updated_at();
create trigger user_preferences_set_updated_at before update on public.user_preferences for each row execute function xpense_private.set_updated_at();
create trigger budgets_set_updated_at before update on public.budgets for each row execute function xpense_private.set_updated_at();
create trigger budget_category_limits_set_updated_at before update on public.budget_category_limits for each row execute function xpense_private.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses for each row execute function xpense_private.set_updated_at();
create trigger peer_splits_set_updated_at before update on public.peer_splits for each row execute function xpense_private.set_updated_at();
create trigger conversation_sessions_set_updated_at before update on public.conversation_sessions for each row execute function xpense_private.set_updated_at();

create or replace function xpense_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'username'), ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    coalesce(new.email, '')
  );
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function xpense_private.handle_new_user() from public;
revoke all on function xpense_private.set_updated_at() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function xpense_private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_category_limits enable row level security;
alter table public.expenses enable row level security;
alter table public.peer_splits enable row level security;
alter table public.peer_split_participants enable row level security;
alter table public.peer_split_obligations enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.conversation_turns enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy preferences_select_own on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy preferences_update_own on public.user_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy budgets_own on public.budgets for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy budget_category_limits_own on public.budget_category_limits for all to authenticated
using (exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = (select auth.uid())))
with check (exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = (select auth.uid())));

create policy expenses_own on public.expenses for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy peer_splits_own on public.peer_splits for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy peer_split_participants_own on public.peer_split_participants for all to authenticated
using (exists (select 1 from public.peer_splits s where s.id = split_id and s.user_id = (select auth.uid())))
with check (exists (select 1 from public.peer_splits s where s.id = split_id and s.user_id = (select auth.uid())));

create policy peer_split_obligations_own on public.peer_split_obligations for all to authenticated
using (exists (select 1 from public.peer_splits s where s.id = split_id and s.user_id = (select auth.uid())))
with check (exists (select 1 from public.peer_splits s where s.id = split_id and s.user_id = (select auth.uid())));

create policy conversation_sessions_select_own_active on public.conversation_sessions for select to authenticated
using ((select auth.uid()) = user_id and expires_at > now());
create policy conversation_sessions_insert_own on public.conversation_sessions for insert to authenticated
with check ((select auth.uid()) = user_id and expires_at <= now() + interval '5 minutes 5 seconds');
create policy conversation_sessions_update_own_active on public.conversation_sessions for update to authenticated
using ((select auth.uid()) = user_id and expires_at > now())
with check ((select auth.uid()) = user_id and expires_at > last_activity_at and expires_at <= last_activity_at + interval '5 minutes 5 seconds');
create policy conversation_sessions_delete_own on public.conversation_sessions for delete to authenticated using ((select auth.uid()) = user_id);

create policy conversation_turns_select_own_active on public.conversation_turns for select to authenticated
using ((select auth.uid()) = user_id and exists (
  select 1 from public.conversation_sessions s
  where s.id = conversation_id and s.user_id = (select auth.uid()) and s.expires_at > now()
));
create policy conversation_turns_insert_own_active on public.conversation_turns for insert to authenticated
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.conversation_sessions s
  where s.id = conversation_id and s.user_id = (select auth.uid()) and s.expires_at > now()
));
create policy conversation_turns_delete_own on public.conversation_turns for delete to authenticated using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.user_preferences to authenticated;
grant select, insert, update, delete on public.budgets, public.budget_category_limits, public.expenses,
  public.peer_splits, public.peer_split_participants, public.peer_split_obligations,
  public.conversation_sessions to authenticated;
grant select, insert, delete on public.conversation_turns to authenticated;
