# Dev Plan: [IDEA-033] Admin AI cost/usage dashboard at /admin/usage

## What This Does
Every AI call in NCCC logs its usage to the `usage_logs` table via `logUsage()`. Paul currently has no way to see how many AI calls are being made, which models are being used, or what the approximate cost is — all without leaving the app. A simple `/admin/usage` server-rendered page surfaces a grouped summary: model name, call count, and estimated token usage over the last 30 days. No new DB columns, no new AI calls, zero cost to render.

This closes the observability gap that STATUS.md documents as "not yet built" — the infrastructure has been in place since the cellar insight work but has never had a front-end.

## User Stories
- As Paul (admin), I want to see how many GPT-5-nano vs GPT-5-mini calls are being made per week so I can evaluate whether the cost is appropriate for the 12-member club.
- As Paul, I want to know if a specific feature (e.g., Winston prose rerolls) is generating more AI cost than expected, so I can decide whether to gate it behind an admin action.

## Implementation

### Phase 1: Query and data shape
1. First, verify the `usage_logs` schema by reading `supabase/migrations/` for the relevant migration:
   ```sql
   -- Expected shape (verify before implementing):
   -- usage_logs: id, user_id, tool, model, prompt_tokens, completion_tokens, total_tokens, created_at
   ```
2. Create `apps/web/src/app/(app)/(shell)/admin/usage/page.tsx` as a server component:
   ```tsx
   import { redirect } from "next/navigation";
   import { requireAdminUserId } from "@/lib/auth/require-admin";
   import { createSupabaseServerClient } from "@/lib/supabase/server";
   import { AppShell } from "@/components/layout/app-shell";
   import { Divider } from "@/components/primitives";

   export default async function UsagePage() {
     const supabase = await createSupabaseServerClient();
     await requireAdminUserId(supabase); // redirects if not admin

     const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

     const { data: rows } = await supabase
       .from("usage_logs")
       .select("model, tool, prompt_tokens, completion_tokens, total_tokens, created_at")
       .gte("created_at", thirtyDaysAgo)
       .order("created_at", { ascending: false });

     // ... aggregate and render
   }
   ```
3. **Checkpoint:** Page renders without TypeScript errors (may show empty data).

### Phase 2: Aggregate and render
1. In `page.tsx`, compute in-memory aggregates from the fetched rows:
   ```ts
   type ModelSummary = {
     model: string;
     calls: number;
     total_tokens: number;
     prompt_tokens: number;
     completion_tokens: number;
   };

   const byModel = new Map<string, ModelSummary>();
   for (const row of rows ?? []) {
     const key = row.model ?? "unknown";
     const existing = byModel.get(key) ?? {
       model: key, calls: 0, total_tokens: 0, prompt_tokens: 0, completion_tokens: 0,
     };
     existing.calls += 1;
     existing.total_tokens += row.total_tokens ?? 0;
     existing.prompt_tokens += row.prompt_tokens ?? 0;
     existing.completion_tokens += row.completion_tokens ?? 0;
     byModel.set(key, existing);
   }

   const summaries = [...byModel.values()].sort((a, b) => b.calls - a.calls);
   const totalCalls = summaries.reduce((n, s) => n + s.calls, 0);
   const totalTokens = summaries.reduce((n, s) => n + s.total_tokens, 0);
   ```
2. Render a clean admin table:
   ```tsx
   return (
     <AppShell>
       <header className="mb-6">
         <p className="text-sm tracking-widest uppercase text-foreground-subtle">Admin</p>
         <h1 className="text-3xl mt-1">AI Usage — Last 30 Days</h1>
         <p className="text-sm text-foreground-muted mt-1">
           {totalCalls.toLocaleString()} calls · {totalTokens.toLocaleString()} total tokens
         </p>
       </header>

       <Divider label="By Model" />

       <div className="overflow-x-auto">
         <table className="w-full text-sm">
           <thead>
             <tr className="text-left text-foreground-subtle border-b border-border">
               <th className="pb-2 pr-4">Model</th>
               <th className="pb-2 pr-4 text-right">Calls</th>
               <th className="pb-2 pr-4 text-right">Prompt tokens</th>
               <th className="pb-2 text-right">Completion tokens</th>
             </tr>
           </thead>
           <tbody>
             {summaries.map((s) => (
               <tr key={s.model} className="border-b border-border/40">
                 <td className="py-2 pr-4 font-mono text-xs">{s.model}</td>
                 <td className="py-2 pr-4 text-right tabular-nums">{s.calls.toLocaleString()}</td>
                 <td className="py-2 pr-4 text-right tabular-nums">{s.prompt_tokens.toLocaleString()}</td>
                 <td className="py-2 text-right tabular-nums">{s.completion_tokens.toLocaleString()}</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>

       <Divider label="Recent Calls" />

       {/* Recent 20 rows table */}
       <div className="overflow-x-auto">
         <table className="w-full text-xs text-foreground-muted">
           <thead>
             <tr className="text-left border-b border-border">
               <th className="pb-1 pr-3">Tool</th>
               <th className="pb-1 pr-3">Model</th>
               <th className="pb-1 pr-3 text-right">Tokens</th>
               <th className="pb-1 text-right">Date</th>
             </tr>
           </thead>
           <tbody>
             {(rows ?? []).slice(0, 20).map((r, i) => (
               <tr key={i} className="border-b border-border/20">
                 <td className="py-1 pr-3">{r.tool ?? "—"}</td>
                 <td className="py-1 pr-3 font-mono">{r.model ?? "—"}</td>
                 <td className="py-1 pr-3 text-right tabular-nums">{(r.total_tokens ?? 0).toLocaleString()}</td>
                 <td className="py-1 text-right text-foreground-subtle">
                   {new Date(r.created_at).toLocaleDateString()}
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
     </AppShell>
   );
   ```
3. **Checkpoint:** Navigate to `/admin/usage` as admin — both tables render with real data.

### Phase 3: Link from admin index
1. Open `apps/web/src/app/(app)/(shell)/admin/page.tsx`
2. Add a link to the usage page alongside the existing admin sections:
   ```tsx
   <Link href="/admin/usage" className="...">AI Usage →</Link>
   ```
3. Run `pnpm lint` and `pnpm build`.
4. **Checkpoint:** Admin index has a navigable "AI Usage" link.

## AI / Embedding Considerations
- Zero AI calls on this page. Pure DB aggregation.
- No LLM cost, no latency beyond the DB query.
- No MSW mocks needed.

## Design System Compliance
- Single brass action: none on this page (admin read-only view) — no brass element needed.
- Winston not used (admin data page, not an empty state or recommendation).
- Etched dividers: `<Divider label="By Model" />` and `<Divider label="Recent Calls" />` at each section break.
- No flavor wheel, no member name rendering needed.

## Mobile Constraints
- Tables are wrapped in `overflow-x-auto` to allow horizontal scroll on narrow screens.
- Admin pages are less mobile-critical but should still be readable.

## Database / RLS
No changes. `usage_logs` RLS should restrict reads to admins or service role — verify the existing policy covers this. If there's no admin-only policy, reads are protected by `requireAdminUserId` at the application layer (same pattern as other admin pages).

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `/admin/usage` renders for admin user with model summary table and recent calls
- [ ] Non-admin member redirect to home (requireAdminUserId handles this)
- [ ] Empty state (0 logs in last 30 days): tables render with empty rows, no crash

## Dependencies
- Requires `requireAdminUserId` helper to be importable (it exists per the admin pattern in other routes).
- Requires `usage_logs` table to have the expected columns — verify migration before Phase 1.

## Estimated Total: ~1 hour
(Phase 1: 15 min, Phase 2: 35 min, Phase 3: 10 min)
