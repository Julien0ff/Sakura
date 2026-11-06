-- Server-clock cursor for incremental pulls (updated_at is the client's last-write-wins clock;
-- a device with a late clock would otherwise write rows other devices never pull).
create or replace function public.set_synced_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end;
$$;
revoke execute on function public.set_synced_at() from public, anon, authenticated;

alter table public.watchlist_entries add column synced_at timestamptz not null default clock_timestamp();
alter table public.history_entries add column synced_at timestamptz not null default clock_timestamp();
alter table public.episode_progress add column synced_at timestamptz not null default clock_timestamp();

create trigger watchlist_synced_at before insert or update on public.watchlist_entries for each row execute function public.set_synced_at();
create trigger history_synced_at before insert or update on public.history_entries for each row execute function public.set_synced_at();
create trigger progress_synced_at before insert or update on public.episode_progress for each row execute function public.set_synced_at();

drop index public.watchlist_entries_updated;
drop index public.history_entries_updated;
drop index public.episode_progress_updated;
create index watchlist_entries_synced on public.watchlist_entries (user_id, synced_at);
create index history_entries_synced on public.history_entries (user_id, synced_at);
create index episode_progress_synced on public.episode_progress (user_id, synced_at);
