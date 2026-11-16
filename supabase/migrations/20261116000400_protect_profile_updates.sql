-- Profile identity, role and account status are maintained by trusted server code.
revoke update on table public.profiles from public, anon, authenticated;
drop policy if exists profiles_self_update on public.profiles;
