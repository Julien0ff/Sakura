-- SAKURA accounts: profiles, synced user data, avatars bucket.
-- Every table is owner-only under RLS. Public profile reads come later (project 3).

-- ───────── Profiles ─────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  banner_id text,
  is_public boolean not null default false,
  visibility jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (
    username is null or (
      username ~ '^[a-z0-9_]{3,20}$'
      and username <> all (array[
        'settings','api','auth','anime','profile','profiles','discover','search','history','watchlist',
        'calendar','legal','onboarding','u','user','users','admin','sakura','login','logout','me','help','about'
      ])
    )
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- New auth user → profile row seeded from the provider metadata (username chosen at onboarding).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'user_name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles: owner select" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: owner insert" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: owner update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ───────── Synced data ─────────
create table public.watchlist_entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  anime_id integer not null,
  title text,
  cover text,
  color text,
  score real,
  status text,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, anime_id)
);

create table public.history_entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  anime_id integer not null,
  title text,
  cover text,
  color text,
  score real,
  status text,
  episode_number integer,
  episode_name text,
  season integer,
  lang text,
  watched_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, anime_id)
);

create table public.episode_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  anime_id integer not null,
  season integer not null,
  episode integer not null,
  time real not null default 0,
  duration real not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, anime_id, season, episode)
);

-- Incremental pulls filter on updated_at.
create index watchlist_entries_updated on public.watchlist_entries (user_id, updated_at);
create index history_entries_updated on public.history_entries (user_id, updated_at);
create index episode_progress_updated on public.episode_progress (user_id, updated_at);

alter table public.watchlist_entries enable row level security;
alter table public.history_entries enable row level security;
alter table public.episode_progress enable row level security;

create policy "watchlist: owner" on public.watchlist_entries
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "history: owner" on public.history_entries
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "progress: owner" on public.episode_progress
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ───────── RPCs ─────────
create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select name ~ '^[a-z0-9_]{3,20}$'
    and name <> all (array[
      'settings','api','auth','anime','profile','profiles','discover','search','history','watchlist',
      'calendar','legal','onboarding','u','user','users','admin','sakura','login','logout','me','help','about'
    ])
    and not exists (select 1 from public.profiles p where p.username = name);
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.username_available(text) from public;
revoke all on function public.delete_own_account() from public;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;

-- ───────── Avatars bucket ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "avatars: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Supabase grants EXECUTE to anon/authenticated directly (not via PUBLIC): revoke explicitly.
revoke execute on function public.delete_own_account() from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
