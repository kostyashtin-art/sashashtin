
-- Одно семейное пространство без регистрации.
-- В Supabase нужно включить Authentication -> Providers -> Anonymous Sign-Ins.

create extension if not exists pgcrypto;

create table if not exists public.kicks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.kicks (family_id, created_by)
select 'c06074a2-a73c-4e3b-a2f0-e1ed320cce5b'::uuid, id from auth.users where false
on conflict do nothing;

alter table public.kicks enable row level security;

drop policy if exists "family read kicks" on public.kicks;
drop policy if exists "family insert kicks" on public.kicks;
drop policy if exists "family delete kicks" on public.kicks;

create policy "family read kicks" on public.kicks
for select to authenticated
using (family_id = 'c06074a2-a73c-4e3b-a2f0-e1ed320cce5b'::uuid);

create policy "family insert kicks" on public.kicks
for insert to authenticated
with check (family_id = 'c06074a2-a73c-4e3b-a2f0-e1ed320cce5b'::uuid and created_by = auth.uid());

create policy "family delete kicks" on public.kicks
for delete to authenticated
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

alter publication supabase_realtime add table public.kicks;
