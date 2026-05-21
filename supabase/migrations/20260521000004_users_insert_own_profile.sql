-- New members create their profile row during invite acceptance (accept-invite
-- action + auth callback). Without this policy, insert fails RLS.

create policy "members can insert own profile"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id and role = 'member');
