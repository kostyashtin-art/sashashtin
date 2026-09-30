create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (family_id,user_id)
);

create table if not exists public.kicks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.kicks enable row level security;

create or replace function public.is_family_member(p_family uuid)
returns boolean language sql security definer set search_path=public as $$
  select exists(select 1 from public.family_members fm where fm.family_id=p_family and fm.user_id=auth.uid());
$$;

drop policy if exists "members read families" on public.families;
create policy "members read families" on public.families for select using (public.is_family_member(id));

drop policy if exists "members read members" on public.family_members;
create policy "members read members" on public.family_members for select using (user_id=auth.uid() or public.is_family_member(family_id));

drop policy if exists "members read kicks" on public.kicks;
create policy "members read kicks" on public.kicks for select using (public.is_family_member(family_id));

drop policy if exists "members insert kicks" on public.kicks;
create policy "members insert kicks" on public.kicks for insert with check (public.is_family_member(family_id) and created_by=auth.uid());

drop policy if exists "members delete kicks" on public.kicks;
create policy "members delete kicks" on public.kicks for delete using (public.is_family_member(family_id));

create or replace function public.create_family()
returns uuid language plpgsql security definer set search_path=public as $$
declare f_id uuid; f_code text;
begin
  f_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.families(code) values(f_code) returning id into f_id;
  insert into public.family_members(family_id,user_id) values(f_id,auth.uid());
  return f_id;
end $$;

create or replace function public.join_family(p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare f_id uuid;
begin
  select id into f_id from public.families where code=upper(trim(p_code));
  if f_id is null then raise exception 'Семья с таким кодом не найдена'; end if;
  insert into public.family_members(family_id,user_id) values(f_id,auth.uid()) on conflict do nothing;
  return f_id;
end $$;

alter publication supabase_realtime add table public.kicks;
