-- Add club_joined_at to users.
-- Nullable — members fill this in to record when they actually joined the club
-- (vs joined_at which tracks app signup). Preferred over joined_at for display.
-- Year range is bounded to 2014 (founding) in the UI; the DB imposes no lower
-- bound beyond being a valid date.

alter table public.users
  add column if not exists club_joined_at date default null;

comment on column public.users.club_joined_at is
  'Month + year the member joined NCCC (member-editable). Null until the member sets it.
   Display prefers this over joined_at (app signup date).';
