# NCCC — Supabase

Migrations live in `migrations/` as timestamped SQL files. Apply them via the Supabase CLI:

```bash
# Install the CLI if needed
brew install supabase/tap/supabase

# Link to the NCCC project (one-time)
supabase link --project-ref jafcwggqgqxrcbuxjreo

# Apply pending migrations to the linked remote project
supabase db push
```

## Conventions

- One concern per migration. Don't combine unrelated changes.
- Filename: `YYYYMMDDhhmmss_short_description.sql` (timestamped + descriptive).
- Always `enable row level security` on new tables, then define explicit policies.
- Functions that bypass RLS (`security definer`) must `set search_path = public` and validate `auth.uid()` themselves.

## What's where

| Phase | Migration | Adds |
|---|---|---|
| 0 | `20260520000001_init_users_and_invites.sql` | `users`, `invites`, `validate_invite_token`, `consume_invite_token` |

Future phases will add: `products`, `product_images` (pgvector), `product_reviews`, `tastings`, `events`, `pairings_cache`, `flavor_wheels`, `usage_logs`.
