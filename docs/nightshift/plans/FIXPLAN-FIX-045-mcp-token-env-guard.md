# Fix: [FIX-045] MCP auth open when `NCCC_MCP_TOKEN` env var is unset

## Problem
`apps/web/src/app/api/[transport]/route.ts` implements bearer-token auth for the MCP server via
a `verifyToken` function:

```typescript
async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const expected = process.env.NCCC_MCP_TOKEN;
  if (!expected || !bearerToken || bearerToken !== expected) return undefined;
  ...
}
const authHandler = withMcpAuth(handler, verifyToken, { required: true });
```

When `NCCC_MCP_TOKEN` is not set in the Vercel environment, `expected` is `undefined`. The `!expected`
branch triggers and `verifyToken` returns `undefined` — the same return value as "invalid token."
Whether the MCP server then accepts or rejects the request depends entirely on how
`withMcpAuth` from the `mcp-handler` package handles a `undefined` return from the verify function.
If the library has any edge case where `required: true` + `undefined` verify result = open access,
the MCP endpoint would be unauthenticated on a fresh deploy or after a secret rotation.

The risk is realistic: a Vercel env var accidentally deleted, a staging deployment without the
secret, or a preview environment forgets to set the var.

**Impact:** If the worst case fires (open access), all 9 MCP tools are callable without any
auth token — including `get_my_cellar` and `suggest_try_next` which expose member shelf and
palate data.

## Root Cause
`apps/web/src/app/api/[transport]/route.ts` lines 390–398: no startup guard that throws
(or logs an error that surfaces in Vercel logs) when `NCCC_MCP_TOKEN` is absent.

## Steps
1. Open `apps/web/src/app/api/[transport]/route.ts`
2. Add a module-level guard immediately before the handler definitions:
   ```typescript
   // At module level, before the handler — fail loudly at cold-start if the secret is absent
   const MCP_TOKEN = process.env.NCCC_MCP_TOKEN;
   if (!MCP_TOKEN) {
     console.error("[mcp] NCCC_MCP_TOKEN is not set — MCP endpoint is disabled.");
   }
   ```
3. Update the `verifyToken` function to use the module-level constant:
   ```typescript
   async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
     if (!MCP_TOKEN || !bearerToken || bearerToken !== MCP_TOKEN) return undefined;
     return { token: bearerToken, clientId: "nccc-mcp" };
   }
   ```
4. Optionally add an early 503 response when token is missing (belt-and-suspenders):
   ```typescript
   export async function GET(req: Request) {
     if (!MCP_TOKEN) return new Response("MCP endpoint not configured.", { status: 503 });
     return authHandler(req);
   }
   export async function POST(req: Request) {
     if (!MCP_TOKEN) return new Response("MCP endpoint not configured.", { status: 503 });
     return authHandler(req);
   }
   ```
   Note: Check whether `GET` and `POST` are exported separately or via a single export — match
   the existing export pattern in the file.
5. Run `pnpm lint`
6. Run `pnpm build`
7. Test: with `NCCC_MCP_TOKEN` set, confirm MCP tools still work. Without the env var set
   locally, confirm the endpoint returns 503 or a clear error rather than accepting requests.

## Files Modified
- `apps/web/src/app/api/[transport]/route.ts` — module-level token constant + startup warning + optional 503 guard

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] MCP tools functional with correct token set
- [ ] Clear error in Vercel logs (or 503) when token is absent
- [ ] `NCCC_MCP_TOKEN` listed in `apps/web/.env.example` (check and add if missing)
