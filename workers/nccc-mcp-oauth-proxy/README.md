# NCCC MCP OAuth Proxy

OAuth 2.1 facade in front of the NCCC Vercel MCP server. Enables **claude.ai web** and **Claude mobile** custom connectors (which require OAuth, not Bearer tokens).

Derived from [Keisuke69/mcp-oauth-proxy](https://github.com/Keisuke69/mcp-oauth-proxy) (MIT), pre-configured for NCCC upstream.

## Architecture

```
Claude (web/mobile) ──OAuth──► Cloudflare Worker ──Bearer──► NCCC /api/mcp (Vercel)
```

Members only enter the **club connect password** on the consent page. The upstream Bearer token is stored as a Worker secret — never pasted into Claude.

## Deploy

KV namespace id is already in `wrangler.toml`. Skip step 1 if you already ran `wrangler kv namespace create KV`.

### 2. Set secrets

Run **one command at a time** — wrangler prompts for the value. Do not paste comments on the same line.

```bash
npx wrangler secret put UPSTREAM_BEARER_TOKEN
npx wrangler secret put ADMIN_SECRET
```

- `UPSTREAM_BEARER_TOKEN` — same value as `NCCC_MCP_TOKEN` on Vercel
- `ADMIN_SECRET` — new club connect password for members (share this, not the MCP token)

### 3. Upstream URL

Already set in `wrangler.toml`:

```toml
UPSTREAM_MCP_URL = "https://nccc-six.vercel.app/api/mcp"
```

### 4. Deploy

```bash
pnpm run deploy
```

Use `pnpm run deploy` (not bare `pnpm deploy`).

Note the Worker URL, e.g. `https://nccc-mcp-oauth-proxy.<account>.workers.dev`.

## Connect claude.ai (web)

1. **Settings → Connectors → Add custom connector**
2. **URL:** `https://YOUR-WORKER.workers.dev/mcp`
3. Claude runs OAuth discovery automatically
4. On the consent page, enter the **club connect password** (`ADMIN_SECRET`)
5. Done — ask pairing questions in chat

No Bearer header field needed on web.

## Connect Claude Desktop (still works)

Desktop can use either:

- **OAuth (same as web):** connector URL = Worker `/mcp`
- **Direct Bearer:** `claude_desktop_config.json` + `mcp-remote` → Vercel `/api/mcp` (see [docs/nccc-mcp-setup.md](../../docs/nccc-mcp-setup.md))

## Development

```bash
pnpm dev
pnpm test
pnpm typecheck
```

## Secrets reference

| Name | Where | Purpose |
|------|-------|---------|
| `UPSTREAM_BEARER_TOKEN` | Worker secret | Forwards to Vercel as `Authorization: Bearer …` |
| `ADMIN_SECRET` | Worker secret | Club connect password on consent form |
| `UPSTREAM_MCP_URL` | `wrangler.toml` var | NCCC MCP endpoint |
| `NCCC_MCP_TOKEN` | Vercel env | Must match `UPSTREAM_BEARER_TOKEN` |
