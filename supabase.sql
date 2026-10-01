-- НАСТРОЙКА ПРОСТОГО СЕМЕЙНОГО ДНЕВНИКА
-- Выполнить один раз в Supabase SQL Editor.

alter table public.families
alter column created_by drop not null;

insert into public.families (id, code, created_by)
values (
  'c06074a2-a73c-4e3b-a2f0-e1ed320cce5b'::uuid,
  'SASHA001',
  null
)
on conflict (id) do nothing;

alter table public.kicks enable row level security;

drop policy if exists "family read kicks" on public.kicks;
drop policy if exists "family insert kicks" on public.kicks;
drop policy if exists "family delete kicks" on public.kicks;
drop policy if exists "members read kicks" on public.kicks;
drop policy if exists "members insert kicks" on public.kicks;
drop policy if exists "members delete kicks" on public.kicks;
drop policy if exists "simple app read kicks" on public.kicks;
drop policy if exists "simple app insert kicks" on public.kicks;
drop policy if exists "simple app delete kicks" on public.kicks;

create policy "simple app read kicks"
on public.kicks
for select
to authenticated
using (family_id = 'c06074a2-a73c-4e3b-a2f0-e1ed320cce5b'::uuid);

create policy "simple app insert kicks"
on public.kicks
for insert
to authenticated
with check (
  family_id = 'c06074a2-a73c-4e3b-a2f0-e1ed320cce5b'::uuid
  and created_by = auth.uid()
);

create policy "simple app delete kicks"
on public.kicks
for delete
to authenticated
using (family_id = 'c06074a2-a73c-4e3b-a2f0-e1ed320cce5b'::uuid);

create or replace function public.cleanup_old_kicks()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.kicks
  where family_id = 'c06074a2-a73c-4e3b-a2f0-e1ed320cce5b'::uuid
    and created_at < now() - interval '1 month';
$$;

grant execute on function public.cleanup_old_kicks() to authenticated;

-- Realtime уже подключён. Повторно ADD TABLE не выполняем.
