-- Admin panel (/admin): unlock / revoke banners and trophies for any user.
-- Admins are listed in a table nobody can read through the API; every admin RPC checks it.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No policy: invisible to anon / authenticated. Only security definer functions read it.

insert into public.admins (user_id)
select id from auth.users where id = 'd2bc4811-5699-487d-8af2-9b388bf672cd'
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
end;
$$;

-- Counters for the top of the panel.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'public_profiles', (select count(*) from public.profiles where is_public),
    'banners', (select count(*) from public.unlocked_banners),
    'trophies', (select count(*) from public.unlocked_banners where is_trophy)
  );
end;
$$;

-- Users matching a username / display name (all users, newest first, when q is empty).
create or replace function public.admin_list_users(q text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pattern text := '%' || replace(replace(replace(coalesce(q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  perform public.assert_admin();
  return (
    select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select p.id, p.username, p.display_name, p.avatar_url, p.banner_id, p.is_public, p.created_at,
             u.last_sign_in_at,
             (select count(*) from public.unlocked_banners b where b.user_id = p.id) as banners,
             (select count(*) from public.unlocked_banners b where b.user_id = p.id and b.is_trophy) as trophies
      from public.profiles p
      join auth.users u on u.id = p.id
      where coalesce(q, '') = ''
         or p.username ilike pattern
         or p.display_name ilike pattern
         or p.id::text = q
      order by p.created_at desc
      limit 50
    ) x
  );
end;
$$;

create or replace function public.admin_user_banners(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return (
    select coalesce(jsonb_agg(to_jsonb(b) - 'user_id' order by b.unlocked_at desc), '[]'::jsonb)
    from public.unlocked_banners b where b.user_id = target
  );
end;
$$;

-- Unlock (or update: trophy flag, picture, title) an anime banner for a user.
create or replace function public.admin_unlock_banner(target uuid, anime integer, url text, anime_title text, trophy boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if anime is null or anime = 0 or url !~ '^https://' then
    raise exception 'banner_invalid';
  end if;
  insert into public.unlocked_banners (user_id, anime_id, banner_url, title, is_trophy)
  values (target, anime, url, anime_title, coalesce(trophy, false))
  on conflict (user_id, anime_id) do update
    set banner_url = excluded.banner_url, title = excluded.title, is_trophy = excluded.is_trophy;
end;
$$;

-- Revoke; a profile showing that banner falls back to the first default.
create or replace function public.admin_revoke_banner(target uuid, anime integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  delete from public.unlocked_banners where user_id = target and anime_id = anime;
  update public.profiles set banner_id = 'default:1' where id = target and banner_id = 'anime:' || anime;
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.assert_admin() from public, anon, authenticated;
revoke all on function public.admin_stats() from public, anon;
revoke all on function public.admin_list_users(text) from public, anon;
revoke all on function public.admin_user_banners(uuid) from public, anon;
revoke all on function public.admin_unlock_banner(uuid, integer, text, text, boolean) from public, anon;
revoke all on function public.admin_revoke_banner(uuid, integer) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_list_users(text) to authenticated;
grant execute on function public.admin_user_banners(uuid) to authenticated;
grant execute on function public.admin_unlock_banner(uuid, integer, text, text, boolean) to authenticated;
grant execute on function public.admin_revoke_banner(uuid, integer) to authenticated;
