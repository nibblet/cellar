# Fix: [FIX-005] Use gpt-5-nano for structured-JSON AI tasks

## Problem
Two AI operations use `MODELS.prose` ("gpt-5-mini") for tasks that are purely structured JSON extraction — not prose generation:

1. **Cellar insight** (`lib/cellar/insight.ts` line 169): Returns `{ bourbons: string | null, cigars: string | null }` — 2–3 sentences per field. Plain JSON, not Winston prose.
2. **Taste rationale** (`lib/taste/rationale.ts` line 109): Returns `{ rationales: [{ id, line }] }` — one sentence per product. Plain JSON.

CLAUDE.md explicitly says to prefer `gpt-5-nano` over `gpt-5-mini` where possible. These tasks are structurally simple (summarize a list into a JSON blob) and are a good fit for nano, which is ~5–10x cheaper per token than mini.

Impact on members: none visible — rationale lines are 8–16 words and cellar insight is 2–3 sentences. Nano handles both comfortably. Fallback logic already exists in both callers (`fallbackRationale`, `generateCellarInsight` catches errors).

## Root Cause
Both callers reference `MODELS.prose` from `lib/openai/client.ts`:
```ts
export const MODELS = {
  vision: "gpt-5-mini",
  mapper: "gpt-5-nano",
  prose: "gpt-5-mini",
} as const;
```
There is no `MODELS.json` or `MODELS.structured` key — the pattern bundles all non-mapper calls under `prose`.

## Steps
1. Open `apps/web/src/lib/openai/client.ts`
2. Add a dedicated `json` model key:
   ```ts
   export const MODELS = {
     vision: "gpt-5-mini",
     mapper: "gpt-5-nano",
     prose: "gpt-5-mini",
     json: "gpt-5-nano",   // structured JSON extraction tasks
   } as const;
   ```
3. Open `apps/web/src/lib/cellar/insight.ts`
4. Change the model reference (line 169):
   ```ts
   // Before:
   model: MODELS.prose,
   // After:
   model: MODELS.json,
   ```
   Also update the `logUsage` call (line 184) and `estimateCost` call (line 188) to use `MODELS.json`:
   ```ts
   model: MODELS.json,
   cost_usd: estimateCost(MODELS.json, tokensIn, tokensOut),
   ```
5. Open `apps/web/src/lib/taste/rationale.ts`
6. Change the model reference (line 109):
   ```ts
   // Before:
   model: MODELS.prose,
   // After:
   model: MODELS.json,
   ```
   Also update `logUsage` (line 123) and `estimateCost` (line 127):
   ```ts
   model: MODELS.json,
   cost_usd: estimateCost(MODELS.json, tokensIn, tokensOut),
   ```
7. Update `PRICING` in `lib/usage/log.ts` to confirm `gpt-5-nano` key is present (it already is — no change needed).
8. Run `pnpm build`.
9. Run `pnpm lint`.
10. Run `pnpm test` — unit tests for `lib/cellar/` and `lib/taste/` should still pass (model change is transparent to test mocks).

## Files Modified
- `apps/web/src/lib/openai/client.ts` — add `json: "gpt-5-nano"` to MODELS
- `apps/web/src/lib/cellar/insight.ts` — switch to `MODELS.json` for model + cost tracking
- `apps/web/src/lib/taste/rationale.ts` — switch to `MODELS.json` for model + cost tracking

## New Files (if any)
None.

## Database Changes (if any)
None — `usage_logs` records whatever model string is passed, no schema constraint.

## Verify
- [x] Build passes
- [x] Lint passes
- [x] `pnpm test` passes
- [ ] Navigate to `/you/cellar` as a member with items on their have shelf — cellar insight regenerates (or serves from cache) without error
- [ ] Navigate to `/you/cellar` as a member who has tried some products — Try Next rationale lines appear
- [ ] `usage_logs` table (if accessible) shows `gpt-5-nano` for `cellar-insight` and `taste-rationale` operations after the next regeneration
