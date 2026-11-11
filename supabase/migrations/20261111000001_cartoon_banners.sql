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
  p public.profiles%rowtype;
  is_owner boolean;
  blk jsonb;
  out_blocks jsonb := '[]'::jsonb;
  content jsonb;
  ban jsonb;
begin
  select * into p from public.profiles where username = name;
  if not found then
    return null;
  end if;
  -- auth.uid() is NULL for visitors: without coalesce, NOT is_owner would be NULL and leak private data.
  is_owner := coalesce(p.id = auth.uid(), false);
  if not p.is_public and not is_owner then
    return null;
  end if;

  for blk in select * from jsonb_array_elements(coalesce(p.visibility -> 'blocks', '[]'::jsonb)) loop
    -- The owner gets every block (edit mode needs them); visitors only visible ones.
    if not is_owner and coalesce((blk ->> 'visible')::boolean, false) is not true then
      continue;
    end if;
    content := case blk ->> 'id'
      when 'stats' then (
        select jsonb_build_object(
          'completed', count(*) filter (where w.list_status = 'completed'),
          'watching', count(*) filter (where w.list_status = 'watching'),
          'avg_rating', round(avg(w.rating)::numeric, 1),
          'hours', (select round(coalesce(sum(e.time), 0)::numeric / 3600) from public.episode_progress e where e.user_id = p.id)
        )
        from public.watchlist_entries w where w.user_id = p.id and w.deleted_at is null)
      when 'favorite' then (
        select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select w.anime_id, w.title, w.cover, w.color, w.list_status, w.rating,
                 w.completed_on_sakura_at is not null as completed_on_sakura
          from public.watchlist_entries w
          where w.user_id = p.id and w.deleted_at is null and w.favorite
          order by w.updated_at desc limit 1) x)
      when 'top_rated' then (
        select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select w.anime_id, w.title, w.cover, w.color, w.list_status, w.rating,
                 w.completed_on_sakura_at is not null as completed_on_sakura
          from public.watchlist_entries w
          where w.user_id = p.id and w.deleted_at is null and w.rating is not null
          order by w.rating desc, w.updated_at desc limit 20) x)
      when 'episode_ratings' then (
        select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select r.anime_id, r.season, r.episode, r.rating,
                 coalesce(w.title, h.title) as title, coalesce(w.cover, h.cover) as cover, coalesce(w.color, h.color) as color
          from public.episode_ratings r
          left join public.watchlist_entries w on w.user_id = r.user_id and w.anime_id = r.anime_id
          left join public.history_entries h on h.user_id = r.user_id and h.anime_id = r.anime_id
          where r.user_id = p.id and r.deleted_at is null and r.rating is not null
          order by r.updated_at desc limit 20) x)
      when 'watching' then (
        select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select w.anime_id, w.title, w.cover, w.color, w.list_status, w.rating,
                 h.episode_number as episode, h.season,
                 w.completed_on_sakura_at is not null as completed_on_sakura
          from public.watchlist_entries w
          left join public.history_entries h on h.user_id = w.user_id and h.anime_id = w.anime_id and h.deleted_at is null
          where w.user_id = p.id and w.deleted_at is null and w.list_status = 'watching'
          order by w.updated_at desc limit 20) x)
      when 'completed' then (
        select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select w.anime_id, w.title, w.cover, w.color, w.list_status, w.rating,
                 w.completed_on_sakura_at is not null as completed_on_sakura
          from public.watchlist_entries w
          where w.user_id = p.id and w.deleted_at is null and w.list_status = 'completed'
          order by w.updated_at desc limit 20) x)
      when 'planned' then (
        select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select w.anime_id, w.title, w.cover, w.color, w.list_status, w.rating,
                 w.completed_on_sakura_at is not null as completed_on_sakura
          from public.watchlist_entries w
          where w.user_id = p.id and w.deleted_at is null and w.list_status = 'planned'
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

