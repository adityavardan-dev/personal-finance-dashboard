-- Use a product-facing name in storage. The existing HTTP API may continue to
-- accept `note` while its persistence adapter maps it to this column.
alter table public.expenses rename column note to description;
comment on column public.expenses.description is 'Optional user-visible description of the transaction.';
