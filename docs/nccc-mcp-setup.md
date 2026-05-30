# NCCC MCP — Pairing advisor for Claude

Remote MCP server on the NCCC Vercel deployment. Connect from Claude desktop, Claude mobile, or Cursor to ask pairing and similarity questions against the live club catalog.

## Endpoint

```
https://YOUR_NCCC_DOMAIN/api/mcp
```

Transport: **Streamable HTTP**. Auth: **Bearer token** (`NCCC_MCP_TOKEN`).

## Server setup (Paul / admin)

1. Generate a long random token, e.g. `openssl rand -hex 32`
2. Set `NCCC_MCP_TOKEN` in Vercel project env vars (Production + Preview)
3. Add the same value to local `apps/web/.env.local` for dev
4. Deploy

## Claude desktop / mobile connector

**Settings → Connectors → Add custom connector**

| Field | Value |
|-------|-------|
| URL | `https://YOUR_NCCC_DOMAIN/api/mcp` |
| Authorization | `Bearer YOUR_NCCC_MCP_TOKEN` |

Example JSON (Claude Code):

```json
{
  "nccc": {
    "type": "http",
    "url": "https://YOUR_NCCC_DOMAIN/api/mcp",
    "headers": {
      "Authorization": "Bearer YOUR_NCCC_MCP_TOKEN"
    }
  }
}
```

## Cursor (stdio fallback)

```json
{
  "nccc": {
    "command": "npx",
    "args": [
      "-y",
      "mcp-remote",
      "https://YOUR_NCCC_DOMAIN/api/mcp",
      "--header",
      "Authorization: Bearer YOUR_NCCC_MCP_TOKEN"
    ]
  }
}
```

## Tools

| Tool | Use when |
|------|----------|
| `recommend` | User names a product — one shot for pair or similar |
| `search_products` | Resolve a name to catalog UUIDs |
| `get_product` | Club voice, specs, flavor tags |
| `suggest_pairings` | Cross-category cigar↔bourbon |
| `suggest_similar` | Same-category, tier-aware alternatives |

Optional `member_email` on `recommend` / `suggest_pairings` biases toward bottles/sticks on that member's **Have** shelf.

## Prompts

- `/what-pairs` — product name → pairing workflow
- `/what-similar` — product name → similar picks workflow

## Local verification

```bash
cd apps/web
pnpm dev
npx @modelcontextprotocol/inspector
# Connect to http://localhost:3000/api/mcp with Authorization: Bearer <token>
```

## Winston voice on phone

Cursor skills do not run in Claude mobile. For Winston tone there, add this to your **Claude Project custom instructions**:

> You are Winston, the Norton Commons Cigar Club narrator — warm Kentucky raconteur, never servile. Answer pairing questions using NCCC MCP tools only. One paragraph, cite scores and club validation when tools return them. Never invent products or members.

Tool-use rules are already in the MCP server `instructions` field.
