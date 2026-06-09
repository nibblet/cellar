# Fix: [FIX-026] MCP tools expose any member's private cellar to any bearer-token holder

## Problem
`get_my_cellar` and `suggest_try_next` in the MCP server accept a `member_email` parameter
and return that member's private shelf contents and palate-based picks. The MCP server uses
a **single shared bearer token** (`NCCC_MCP_TOKEN`). Any client that holds the token can
query any club member's private cellar and recommendation list by passing their email address.

For a private club of 12 friends who trust each other this may be acceptable, but the behavior
should be explicit rather than accidental — and the existing Cloudflare OAuth proxy provides
a clean path to per-user token scoping if needed.

## Root Cause
`apps/web/src/lib/mcp/tools.ts`, `mcpGetMyCellar` (~line 481) and `mcpSuggestTryNext`
(~line 534). Both call `requireMemberIdByEmail(supabase, input.member_email)` without
checking whether `input.member_email` matches the caller's identity. There is no per-caller
identity attached to the shared `NCCC_MCP_TOKEN`.

## Options

### Option A — Document as intentional (5 min, recommended near-term)
Add a comment block in `lib/mcp/tools.ts` at the `requireMemberIdByEmail` helper explaining
the single-token model and that cross-member queries are a known design trade-off for the
12-person club.

### Option B — Per-user OAuth scoping via the Cloudflare proxy (medium-term, proper fix)
The `workers/nccc-mcp-oauth-proxy/` worker already implements OAuth 2.0 + PKCE. Each member
can authenticate individually; the worker stores their identity in KV. Extend the worker to:
1. Inject a verified `X-Nccc-Member-Email` header on proxied requests.
2. In the MCP handler (`app/api/[transport]/route.ts`), pass the header to the tool context.
3. In `mcpGetMyCellar` and `mcpSuggestTryNext`, validate `input.member_email === context.memberEmail`.

## Steps (Option A — immediate)

1. Open `apps/web/src/lib/mcp/tools.ts`
2. Before `async function requireMemberIdByEmail` (~line 49), add:
```typescript
// Single-token design: NCCC_MCP_TOKEN is shared among all authorized MCP clients.
// Any holder can query any member's data by passing their email. Intentional for
// the 12-member private club; revisit if per-user token scoping is needed via the
// OAuth proxy (workers/nccc-mcp-oauth-proxy/).
```
3. Run `pnpm lint`
4. Run `pnpm build`

## Steps (Option B — full fix, separate session)

1. Open `workers/nccc-mcp-oauth-proxy/src/index.ts`
2. After the KV token lookup, inject `X-Nccc-Member-Email: <storedEmail>` into the forwarded request headers.
3. Open `apps/web/src/app/api/[transport]/route.ts`
4. Extract `X-Nccc-Member-Email` from the incoming request headers and attach it to the tool execution context.
5. Open `apps/web/src/lib/mcp/tools.ts`
6. In `mcpGetMyCellar` and `mcpSuggestTryNext`: if `context.memberEmail` is present, return 403 when `input.member_email !== context.memberEmail`.
7. Run `pnpm build`, `pnpm lint`, worker `wrangler deploy`.

## Files Modified

### Option A
- `apps/web/src/lib/mcp/tools.ts` — add explanatory comment before `requireMemberIdByEmail`

### Option B (additional)
- `workers/nccc-mcp-oauth-proxy/src/index.ts` — inject verified email header
- `apps/web/src/app/api/[transport]/route.ts` — extract + pass email to tool context
- `apps/web/src/lib/mcp/tools.ts` — validate caller email in cellar + try-next tools

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] (Option B) Calling `get_my_cellar` with a different member's email returns 403
- [ ] (Option B) Calling with own email returns cellar data normally
