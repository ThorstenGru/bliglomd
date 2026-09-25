-- Returns every public-schema base table with its column list, in declaration order.
-- Used by admin-weekly-db-dump so the export stays exhaustive as the schema evolves,
-- and so empty tables still get a correct CSV header.
create or replace function public.admin_schema_snapshot()
returns table(table_name text, columns text[])
language sql
security definer
set search_path = public
as $$
  select c.table_name, array_agg(c.column_name order by c.ordinal_position)
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
  group by c.table_name
  order by c.table_name;
$$;

revoke all on function public.admin_schema_snapshot() from public;
grant execute on function public.admin_schema_snapshot() to service_role;
