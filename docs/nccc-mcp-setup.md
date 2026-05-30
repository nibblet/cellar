# NCCC MCP — Pairing advisor for Claude

Remote MCP server on the NCCC Vercel deployment. Ask pairing and similarity questions against the live club catalog.

## Endpoints

| Client | URL | Auth |
|--------|-----|------|
| **Claude web / mobile** | `https://YOUR-WORKER.workers.dev/mcp` | OAuth (see below) |
| **Claude Desktop (direct)** | `https://YOUR_NCCC_DOMAIN/api/mcp` | Bearer via `mcp-remote` |
| **Claude Code / Cursor** | `https://YOUR_NCCC_DOMAIN/api/mcp` | Bearer header |

---

## Claude web & mobile (OAuth proxy)

claude.ai does **not** support pasted Bearer tokens. Use the Cloudflare OAuth proxy:

### One-time deploy (Paul)

See [workers/nccc-mcp-oauth-proxy/README.md](../workers/nccc-mcp-oauth-proxy/README.md):

1. Deploy Worker to Cloudflare
2. Set `UPSTREAM_MCP_URL` → your Vercel `/api/mcp`
3. Set secrets: `UPSTREAM_BEARER_TOKEN` (= `NCCC_MCP_TOKEN`), `ADMIN_SECRET` (= club connect password)

### Each member (web)

1. **claude.ai → Settings → Connectors → Add custom connector**
2. **URL:** `https://YOUR-WORKER.workers.dev/mcp`
3. Claude opens OAuth — enter the **club connect password** Paul shared
4. Ask: *"What bourbon pairs with Perdomo Champagne?"*

No header field on web — OAuth handles it.

---

## Claude Desktop (Bearer via config file)

The Connectors UI does not support Bearer headers. Use `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nccc": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://YOUR_NCCC_DOMAIN/api/mcp",
        "--header",
        "Authorization: Bearer YOUR_NCCC_MCP_TOKEN"
      ]
    }
  }
}
```

Quit and restart Claude Desktop.

**Alternative:** use the OAuth Worker URL in Desktop Connectors (same as web) — no config file needed.

---

## Claude Code

```bash
claude mcp add nccc --transport http \
  --header "Authorization: Bearer YOUR_NCCC_MCP_TOKEN" \
  https://YOUR_NCCC_DOMAIN/api/mcp
```

---

## Cursor

```json
{
  "mcpServers": {
    "nccc": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://YOUR_NCCC_DOMAIN/api/mcp",
        "--header",
        "Authorization: Bearer YOUR_NCCC_MCP_TOKEN"
      ]
    }
  }
}
```

Personal skill: `~/.cursor/skills/nccc-pairing/SKILL.md`

---

## Server setup (Paul / admin)

1. `openssl rand -hex 32` → `NCCC_MCP_TOKEN` on Vercel
2. Deploy NCCC app
3. Deploy OAuth Worker with matching `UPSTREAM_BEARER_TOKEN`
4. Choose a separate **club connect password** for `ADMIN_SECRET` (share with members)

---

## Tools

| Tool | Use when |
|------|----------|
| `tonights_pick` | "What should we smoke tonight?" — daily cigar+bourbon (feed Daily Pour logic) |
| `recommend` | User names a product — one shot for pair or similar |
| `search_products` | Resolve a name to catalog UUIDs |
| `get_product` | Club voice, specs, flavor tags |
| `suggest_pairings` | Cross-category cigar↔bourbon |
| `suggest_similar` | Same-category, tier-aware alternatives |

Optional `member_email` biases pairings toward the member's **Have** shelf.

---

## Local verification (Vercel MCP direct)

```bash
cd apps/web && pnpm dev
npx @modelcontextprotocol/inspector
# http://localhost:3000/api/mcp + Bearer YOUR_NCCC_MCP_TOKEN
```

---

## Winston voice on phone

Add to **Claude Project custom instructions**:

> You are Winston, the Norton Commons Cigar Club narrator — warm Kentucky raconteur. Use NCCC MCP tools only. One paragraph, cite scores and club validation when present. Never invent products or members.
