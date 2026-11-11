-- Support cartoon banners (negative anime IDs) in admin_unlock_banner, set_banner, and get_public_profile.

-- 1. admin_unlock_banner: allow negative anime IDs (cartoons)
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

revoke all on function public.admin_unlock_banner(uuid, integer, text, text, boolean) from public, anon;
grant execute on function public.admin_unlock_banner(uuid, integer, text, text, boolean) to authenticated;

-- 2. set_banner: allow negative anime IDs (^anime:-?[0-9]{1,9}$)
create or replace function public.set_banner(banner text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if banner ~ '^default:[1-4]$' then
    null;
  elsif banner ~ '^anime:-?[0-9]{1,9}$' then
    if not exists (
      select 1 from public.unlocked_banners u
      where u.user_id = uid and u.anime_id = substring(banner from 7)::int
    ) then
      raise exception 'banner_locked';
    end if;
  else
    raise exception 'banner_invalid';
  end if;
  update public.profiles set banner_id = banner where id = uid;
end;
$$;

revoke all on function public.set_banner(text) from public;
revoke execute on function public.set_banner(text) from anon;
grant execute on function public.set_banner(text) to authenticated;

-- 3. get_public_profile: allow negative anime IDs for public banner resolution
create or replace function public.get_public_profile(name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p record;
  vis jsonb;
  blk jsonb;
  out_blocks jsonb := '[]'::jsonb;
  content jsonb;
  ban jsonb;
  is_owner boolean;
begin
  select id, username, display_name, avatar_url, banner_id, visibility, is_public, created_at
    into p
    from public.profiles
    where lower(username) = lower(name);

  if p.id is null then
    return null;
  end if;

  is_owner := (auth.uid() = p.id);

  if not is_owner and not coalesce(p.is_public, true) then
    return null;
  end if;

  vis := coalesce(p.visibility, '{"blocks":[]}'::jsonb);

  for blk in select * from jsonb_array_elements(coalesce(vis -> 'blocks', '[]'::jsonb)) loop
    if not is_owner and not coalesce((blk ->> 'visible')::boolean, false) then
      continue;
    end if;
    content := case blk ->> 'id'
      when 'stats' then (
        select jsonb_build_object(
          'anime_count', count(*),
          'episode_count', coalesce(sum(episodes_watched), 0),
          'days_watched', round((coalesce(sum(minutes_watched), 0) / 1440.0)::numeric, 1),
          'mean_score', round(coalesce(avg(score), 0)::numeric, 1)
        ) from public.profile_stats where user_id = p.id)
      when 'favorite' then (
        select coalesce(jsonb_agg(x.row), '[]'::jsonb) from (
          select jsonb_build_object('anime_id', anime_id, 'title', title, 'cover_url', cover_url, 'color', color, 'score', score) as row
          from public.watchlist where user_id = p.id and is_favorite and not coalesce(is_deleted, false)
          order by updated_at desc limit 1) x)
      when 'watching' then (
        select coalesce(jsonb_agg(x.row), '[]'::jsonb) from (
          select jsonb_build_object('anime_id', anime_id, 'title', title, 'cover_url', cover_url, 'color', color, 'score', score, 'status', status) as row
          from public.watchlist where user_id = p.id and status = 'watching' and not coalesce(is_deleted, false)
          order by updated_at desc limit 20) x)
      when 'completed' then (
        select coalesce(jsonb_agg(x.row), '[]'::jsonb) from (
          select jsonb_build_object('anime_id', anime_id, 'title', title, 'cover_url', cover_url, 'color', color, 'score', score, 'status', status) as row
          from public.watchlist where user_id = p.id and status = 'completed' and not coalesce(is_deleted, false)
          order by coalesce(completed_at, updated_at) desc limit 20) x)
      when 'planned' then (
        select coalesce(jsonb_agg(x.row), '[]'::jsonb) from (
          select jsonb_build_object('anime_id', anime_id, 'title', title, 'cover_url', cover_url, 'color', color, 'score', score, 'status', status) as row
          from public.watchlist where user_id = p.id and status = 'planned' and not coalesce(is_deleted, false)
          order by updated_at desc limit 20) x)
      when 'top_rated' then (
        select coalesce(jsonb_agg(x.row), '[]'::jsonb) from (
          select jsonb_build_object('anime_id', anime_id, 'title', title, 'cover_url', cover_url, 'color', color, 'score', score, 'user_rating', user_rating) as row
          from public.watchlist where user_id = p.id and user_rating is not null and not coalesce(is_deleted, false)
          order by user_rating desc, updated_at desc limit 10) x)
      when 'episode_ratings' then (
        select coalesce(jsonb_agg(x.row), '[]'::jsonb) from (
          select jsonb_build_object('anime_id', r.anime_id, 'season', r.season, 'episode', r.episode, 'rating', r.rating, 'title', w.title, 'cover_url', w.cover_url) as row
          from public.episode_ratings r
          join public.watchlist w on w.user_id = r.user_id and w.anime_id = r.anime_id and not coalesce(w.is_deleted, false)
          where r.user_id = p.id and not coalesce(r.is_deleted, false)
          order by w.updated_at desc limit 20) x)
      else null
    end;
    if content is not null then
      out_blocks := out_blocks || jsonb_build_array(jsonb_build_object(
        'id', blk ->> 'id',
        'visible', coalesce((blk ->> 'visible')::boolean, false),
        case when blk ->> 'id' = 'stats' then 'stats' else 'items' end, content));
    end if;
  end loop;

  select jsonb_build_object('id', p.banner_id, 'url', u.banner_url, 'title', u.title)
    into ban
    from (select 1) one
    left join public.unlocked_banners u
      on u.user_id = p.id
     and u.anime_id = case when p.banner_id ~ '^anime:-?[0-9]{1,9}$' then substring(p.banner_id from 7)::int end;

  return jsonb_build_object(
    'username', p.username,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'created_at', p.created_at,
    'is_public', p.is_public,
    'is_owner', is_owner,
    'banner', ban,
    'trophies', (
      select coalesce(jsonb_agg(jsonb_build_object('anime_id', t.anime_id, 'title', t.title, 'banner_url', t.banner_url) order by t.unlocked_at desc), '[]'::jsonb)
      from public.unlocked_banners t where t.user_id = p.id and t.is_trophy),
    'blocks', out_blocks
  );
end;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

