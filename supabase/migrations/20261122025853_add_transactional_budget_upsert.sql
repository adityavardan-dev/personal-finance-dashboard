-- Atomically replace a user's budget and category limits while RLS derives
-- ownership from the authenticated Supabase JWT.
create or replace function public.upsert_my_budget(
  p_monthly_limit_minor bigint,
  p_currency text,
  p_category_limits jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_budget public.budgets;
  v_item jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_monthly_limit_minor is not null and p_monthly_limit_minor <= 0 then
    raise exception 'Monthly budget must be positive';
  end if;
  if p_currency not in ('INR', 'USD', 'EUR') then raise exception 'Unsupported currency'; end if;
  if jsonb_typeof(p_category_limits) <> 'array' then raise exception 'Category limits must be an array'; end if;
  if p_monthly_limit_minor is null and jsonb_array_length(p_category_limits) > 0 then
    raise exception 'Category limits require a monthly budget';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_category_limits) item
    group by btrim(item ->> 'category') having count(*) > 1
  ) then
    raise exception 'Category budget names must be unique';
  end if;

  insert into public.budgets (user_id, monthly_limit_minor, currency)
  values (v_user_id, p_monthly_limit_minor, p_currency)
  on conflict (user_id) do update
  set monthly_limit_minor = excluded.monthly_limit_minor, currency = excluded.currency
  returning * into v_budget;

  delete from public.budget_category_limits where budget_id = v_budget.id;
  for v_item in select value from jsonb_array_elements(p_category_limits)
  loop
    if nullif(btrim(v_item ->> 'category'), '') is null
       or (v_item ->> 'limit_minor') is null
       or (v_item ->> 'limit_minor')::bigint < 0 then
      raise exception 'Invalid category budget';
    end if;
    insert into public.budget_category_limits (budget_id, category, limit_minor)
    values (v_budget.id, btrim(v_item ->> 'category'), (v_item ->> 'limit_minor')::bigint);
  end loop;

  return jsonb_build_object(
    'monthly_limit_minor', v_budget.monthly_limit_minor,
    'currency', v_budget.currency,
    'created_at', v_budget.created_at,
    'updated_at', v_budget.updated_at,
    'category_limits', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'limit_minor', limit_minor) order by category)
      from public.budget_category_limits where budget_id = v_budget.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.upsert_my_budget(bigint, text, jsonb) from public;
grant execute on function public.upsert_my_budget(bigint, text, jsonb) to authenticated;
