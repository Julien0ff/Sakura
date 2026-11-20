-- Weekly Discord recap (scripts/discord-announce.mjs recap): the anime most watched on SAKURA over
-- the last 7 days. Only anonymous counts leave the database, and an anime needs at least 2 viewers
-- so a single person's history can't be read from it.
create or replace function public.weekly_top_anime(max_rows integer default 5)
returns table (anime_id integer, title text, cover text, viewers bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select h.anime_id, max(h.title) as title, max(h.cover) as cover, count(distinct h.user_id) as viewers
  from public.history_entries h
  where h.deleted_at is null
    and h.watched_at >= now() - interval '7 days'
  group by h.anime_id
  having count(distinct h.user_id) >= 2
  order by viewers desc, max(h.watched_at) desc
  limit least(greatest(max_rows, 1), 10);
$$;

revoke all on function public.weekly_top_anime(integer) from public;
grant execute on function public.weekly_top_anime(integer) to anon, authenticated;
