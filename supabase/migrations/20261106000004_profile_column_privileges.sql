-- banner_id may only change through set_banner() (which checks unlocks); id/created_at never.
revoke update on public.profiles from authenticated, anon;
grant update (username, display_name, avatar_url, is_public, visibility, settings) on public.profiles to authenticated;
-- get_public_profile iterates visibility->'blocks': keep it an array.
alter table public.profiles add constraint visibility_blocks_array
  check (jsonb_typeof(visibility -> 'blocks') = 'array');
