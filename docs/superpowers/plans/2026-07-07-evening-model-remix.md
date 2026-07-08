# Evening Model Remix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remix The Cellar into the Evening Model IA (Cellar · Shelf · Capture · Log · You), demote Catalog/Pairings, add catalog performance fixes, and make Try/Hunt next feel fresh day-to-day.

**Architecture:** Extend `lib/navigation/paths.ts` with canonical Evening Model routes. Keep `/` as the concierge home (`CellarHomeClient`). Promote `/shelf` to a real collection page. Add `/log` as a merged timeline. Rewrite `/you` as taste profile. Paginate catalog with thumbnail signing. Add daily-seed rotation helpers in `lib/cellar/` reusing `fnv1a32` from pick-pour.

**Tech Stack:** Next.js 16 App Router (RSC + Server Actions), Supabase, Tailwind v4, TypeScript strict, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-07-07-evening-model-remix-design.md`

**Run commands from:** `apps/web/`

**Core commands:**
- `pnpm test -- <file>` — targeted Vitest
- `pnpm test` — full suite
- `pnpm typecheck` — TypeScript
- `pnpm lint` — Biome

---

## File structure lock-in

### Create

| File | Responsibility |
|---|---|
| `src/lib/navigation/paths.ts` | Add `SHELF_PATH`, `LOG_PATH`, `CATALOG_PATH`, `TONIGHT_PATH`; update auth exit to `/` |
| `src/lib/navigation/paths.test.ts` | Lock Evening Model routes |
| `src/lib/cellar/daily-rotation.ts` | Daily shuffle within top-N scored items |
| `src/lib/cellar/daily-rotation.test.ts` | Unit tests for rotation stability |
| `src/lib/cellar/recent-tastings.ts` | Load product IDs tasted in last N days |
| `src/lib/cellar/recent-tastings.test.ts` | Unit tests |
| `src/lib/catalog/paginate.ts` | Parse `page`/`pageSize` from search params |
| `src/lib/catalog/paginate.test.ts` | Unit tests |
| `src/lib/catalog/fresh-drops.ts` | Query recently added/enriched catalog products |
| `src/lib/catalog/fresh-drops.test.ts` | Unit tests |
| `src/lib/log/load-timeline.ts` | Merge tastings + pairing sessions into sorted timeline |
| `src/lib/log/load-timeline.test.ts` | Unit tests |
| `src/lib/log/types.ts` | `LogEntry` discriminated union |
| `src/app/(app)/(shell)/shelf/page.tsx` | Standalone Shelf page |
| `src/app/(app)/(shell)/log/page.tsx` | Log timeline page |
| `src/components/log/pairing-log-card.tsx` | Visual pairing entry (dual images) |
| `src/components/log/tasting-log-card.tsx` | Tasting entry card |
| `src/components/log/log-filter-tabs.tsx` | Client filter tabs (`all`/`tastings`/`pairings`) |
| `src/components/catalog/catalog-pagination.tsx` | Load-more or page controls |
| `src/components/you/taste-profile-hero.tsx` | You page hero + stats |
| `src/components/cellar/tonight-shuffle-button.tsx` | Shuffle control for Tonight's pick |

### Modify

| File | Change |
|---|---|
| `src/components/nav/bottom-nav.tsx` | Cellar · Shelf · Capture · Log · You |
| `src/components/nav/bottom-nav.test.tsx` | Assert new nav |
| `src/app/(app)/(shell)/page.tsx` | Keep home; wire shuffle |
| `src/app/(app)/(shell)/you/page.tsx` | Taste profile rewrite |
| `src/app/(app)/(shell)/you/cellar/page.tsx` | Redirect → `/shelf` |
| `src/app/(app)/(shell)/pairings/page.tsx` | Redirect → `/log?filter=pairings` |
| `src/app/(app)/(shell)/you/pairings/page.tsx` | Redirect → `/log?filter=pairings` |
| `src/app/(app)/(shell)/you/tastings/page.tsx` | Redirect → `/log?filter=tastings` |
| `src/lib/feed/queries.ts` | Add `signThumbnailPaths()` with transform width |
| `src/lib/feed/catalog-queries.ts` | Support offset/limit pagination |
| `src/app/(app)/(shell)/catalog/page.tsx` | Paginate (36), makers default, thumbs |
| `src/components/feed/catalog-card.tsx` | Lazy load, thumb src |
| `src/lib/find-next/load.ts` | Apply rotation + recent-taste deprioritization |
| `src/lib/cellar/home-v2.ts` | Hunt next lane split |
| `src/components/cellar/home-v2-sections.tsx` | Hunt sub-lanes, Try next pairing chips |
| `src/components/onboarding/welcome-flow.tsx` | Update NAV_MAP |
| `src/app/(auth)/login/actions.ts` | Redirect to `/` |
| `src/lib/onboarding/complete.ts` | `lounge` exit → `/` |

---

## Phase 1 — Navigation & routing shell

### Task 1: Evening Model path contract

**Files:**
- Modify: `apps/web/src/lib/navigation/paths.ts`
- Modify: `apps/web/src/lib/navigation/paths.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// append to apps/web/src/lib/navigation/paths.test.ts
import {
  TONIGHT_PATH,
  SHELF_PATH,
  LOG_PATH,
  CATALOG_PATH,
} from "./paths";

it("locks Evening Model routes", () => {
  expect(TONIGHT_PATH).toBe("/");
  expect(SHELF_PATH).toBe("/shelf");
  expect(LOG_PATH).toBe("/log");
  expect(CATALOG_PATH).toBe("/catalog");
});

it("maps lounge onboarding exit to Cellar home", () => {
  expect(getOnboardingExitPath("lounge")).toBe("/");
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/web && pnpm test -- src/lib/navigation/paths.test.ts`

- [ ] **Step 3: Implement paths**

```ts
// apps/web/src/lib/navigation/paths.ts
export const TONIGHT_PATH = "/";
export const SHELF_PATH = "/shelf";
export const LOG_PATH = "/log";
export const CATALOG_PATH = "/catalog";
export const APP_HOME_PATH = "/you";
export const CELLAR_PATH = TONIGHT_PATH; // alias for legacy imports

export function getOnboardingExitPath(exit: "capture" | "preferences" | "lounge"): string {
  switch (exit) {
    case "capture":
      return "/capture";
    case "preferences":
      return `${SETTINGS_PATH}#preferences`;
    case "lounge":
      return TONIGHT_PATH;
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/navigation/paths.ts src/lib/navigation/paths.test.ts
git commit -m "refactor(nav): add Evening Model route contract"
```

---

### Task 2: Bottom nav remix

**Files:**
- Modify: `apps/web/src/components/nav/bottom-nav.tsx`
- Modify: `apps/web/src/components/nav/bottom-nav.test.tsx`

- [ ] **Step 1: Write failing nav test**

```tsx
it("renders Cellar, Shelf, Log, You, and Capture — no Catalog or Pairings", () => {
  render(<BottomNav />);
  expect(screen.getByRole("link", { name: /cellar/i })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: /shelf/i })).toHaveAttribute("href", "/shelf");
  expect(screen.getByRole("link", { name: /log/i })).toHaveAttribute("href", "/log");
  expect(screen.getByRole("link", { name: /you/i })).toHaveAttribute("href", "/you");
  expect(screen.queryByRole("link", { name: /catalog/i })).toBeNull();
  expect(screen.queryByRole("link", { name: /pairings/i })).toBeNull();
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/web && pnpm test -- src/components/nav/bottom-nav.test.tsx`

- [ ] **Step 3: Update bottom-nav.tsx**

Replace `SIDE_ITEMS` with:

```tsx
import { Archive, BookOpen, Layers, Plus, User } from "lucide-react";
import { LOG_PATH, SHELF_PATH, TONIGHT_PATH, APP_HOME_PATH } from "@/lib/navigation/paths";

const SIDE_ITEMS = [
  { href: TONIGHT_PATH, label: "Cellar", icon: BookOpen, match: (p) => p === TONIGHT_PATH },
  { href: SHELF_PATH, label: "Shelf", icon: Layers, match: (p) => p.startsWith(SHELF_PATH) },
  { href: LOG_PATH, label: "Log", icon: Archive, match: (p) => p.startsWith(LOG_PATH) },
  { href: APP_HOME_PATH, label: "You", icon: User, match: (p) => p.startsWith("/you") || p.startsWith("/settings") },
];
```

Grid stays `grid-cols-5` with Capture center.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/bottom-nav.tsx src/components/nav/bottom-nav.test.tsx
git commit -m "refactor(nav): Evening Model bottom tabs"
```

---

### Task 3: Redirects sweep

**Files:**
- Modify: `apps/web/src/app/(app)/(shell)/you/cellar/page.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/pairings/page.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/you/pairings/page.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/you/tastings/page.tsx`
- Modify: `apps/web/src/app/(auth)/login/actions.ts`
- Modify: `apps/web/src/lib/onboarding/complete.ts`

- [ ] **Step 1: Implement redirects**

```tsx
// you/cellar/page.tsx
redirect("/shelf");

// pairings/page.tsx
redirect("/log?filter=pairings");

// you/pairings/page.tsx
redirect("/log?filter=pairings");

// you/tastings/page.tsx
redirect("/log?filter=tastings");
```

```ts
// login/actions.ts + onboarding lounge exit
import { TONIGHT_PATH } from "@/lib/navigation/paths";
redirect(TONIGHT_PATH);
```

- [ ] **Step 2: Manual smoke**

1. `/pairings` → `/log?filter=pairings`
2. `/you/cellar` → `/shelf`
3. Login → `/`

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(routes): redirect legacy paths to Evening Model"
```

---

## Phase 2 — Shelf page

### Task 4: Standalone `/shelf`

**Files:**
- Modify: `apps/web/src/app/(app)/(shell)/shelf/page.tsx`

- [ ] **Step 1: Replace redirect with Shelf page**

```tsx
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { CellarStatStrip } from "@/components/cellar/home-v2-sections";
import { CellarSection } from "@/components/members/sections";
import { Divider } from "@/components/primitives";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { loadProductTypes, splitIdsByProductType } from "@/lib/products/split-by-type";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ShelfPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name_first, name_last_initial")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile) redirect("/login");

  const snapshot = await loadCellarSnapshot(supabase, auth.user.id);
  const haveTypes = await loadProductTypes(supabase, snapshot.have);
  const { bourbons, cigars } = splitIdsByProductType(haveTypes);

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="text-3xl">Your shelf</h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-foreground-subtle">
          Have · Want · Tried
        </p>
      </header>
      <CellarStatStrip
        bottleCount={bourbons.length}
        cigarCount={cigars.length}
        huntingCount={snapshot.want.size}
      />
      <Divider label="The shelf" />
      <CellarSection
        memberId={auth.user.id}
        memberFirstName={profile.name_first}
        isOwnProfile={true}
      />
    </AppShell>
  );
}
```

- [ ] **Step 2: Remove CellarSection from `/you/page.tsx`** (delete `#shelf` block and divider)

- [ ] **Step 3: Manual verify** — Shelf tab shows Have/Want/Tried; You no longer has inventory

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(shelf): promote collection to primary tab"
```

---

## Phase 3 — Log timeline

### Task 5: Timeline loader

**Files:**
- Create: `apps/web/src/lib/log/types.ts`
- Create: `apps/web/src/lib/log/load-timeline.ts`
- Create: `apps/web/src/lib/log/load-timeline.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { mergeTimeline } from "./load-timeline";

describe("mergeTimeline", () => {
  it("sorts tastings and pairings by created_at descending", () => {
    const result = mergeTimeline(
      [{ kind: "tasting", id: "t1", created_at: "2026-07-01T00:00:00Z", product_id: "p1", product_name: "A", product_type: "cigar", image_url: null }],
      [{ kind: "pairing", id: "s1", created_at: "2026-07-02T00:00:00Z", cigar_id: "c1", bourbon_id: "b1", cigar_name: "C", bourbon_name: "B", both_recommended: true, pairing_note: null, cigar_image_url: null, bourbon_image_url: null }],
    );
    expect(result[0].kind).toBe("pairing");
    expect(result[1].kind).toBe("tasting");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement types + merge**

```ts
// types.ts
export type TastingLogEntry = {
  kind: "tasting";
  id: string;
  created_at: string;
  product_id: string;
  product_name: string;
  product_type: "cigar" | "bourbon";
  image_url: string | null;
};

export type PairingLogEntry = {
  kind: "pairing";
  id: string;
  created_at: string;
  cigar_id: string;
  bourbon_id: string;
  cigar_name: string;
  bourbon_name: string;
  both_recommended: boolean;
  pairing_note: string | null;
  cigar_image_url: string | null;
  bourbon_image_url: string | null;
};

export type LogEntry = TastingLogEntry | PairingLogEntry;
```

```ts
// load-timeline.ts
export function mergeTimeline(tastings: TastingLogEntry[], pairings: PairingLogEntry[]): LogEntry[] {
  return [...tastings, ...pairings].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
```

Add `loadMemberTimeline(supabase, memberId, filter)` that queries existing tasting + `loadMemberPairingSessions` loaders and joins product images.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

---

### Task 6: Log page + visual cards

**Files:**
- Create: `apps/web/src/app/(app)/(shell)/log/page.tsx`
- Create: `apps/web/src/components/log/pairing-log-card.tsx`
- Create: `apps/web/src/components/log/tasting-log-card.tsx`
- Create: `apps/web/src/components/log/log-filter-tabs.tsx`

- [ ] **Step 1: Build PairingLogCard** — reuse `CircleBadge` sizing from `home-v2-sections.tsx` at 64px; show cigar × bourbon names, date, optional quote line-clamp-2

- [ ] **Step 2: Build Log page**

```tsx
// log/page.tsx — server component
const filter = parseLogFilter(searchParams.filter);
const entries = await loadMemberTimeline(supabase, memberId, filter);
// render LogFilterTabs + map entries to TastingLogCard | PairingLogCard
```

- [ ] **Step 3: Manual verify** — Log tab shows merged timeline; filters work

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(log): unified tasting and pairing timeline"
```

---

## Phase 4 — You taste profile

### Task 7: Rewrite `/you`

**Files:**
- Create: `apps/web/src/components/you/taste-profile-hero.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/you/page.tsx`

- [ ] **Step 1: Build taste-profile-hero** — stat strip + `loadCachedInsight` teaser

- [ ] **Step 2: Rewrite you/page.tsx**

Sections in order:
1. `TasteProfileHero`
2. Last session highlight (most recent log entry — query 1 tasting + 1 pairing, pick newer)
3. `<Divider label="Browse" />` — links to `/catalog`, `/settings`
4. Remove PersonalCard grid and CellarSection

- [ ] **Step 3: Manual verify**

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(you): taste profile instead of archive hub"
```

---

## Phase 5 — Catalog performance

### Task 8: Pagination helpers

**Files:**
- Create: `apps/web/src/lib/catalog/paginate.ts`
- Create: `apps/web/src/lib/catalog/paginate.test.ts`
- Modify: `apps/web/src/lib/feed/catalog-queries.ts`

- [ ] **Step 1: Write failing test**

```ts
import { parseCatalogPage } from "./paginate";

it("defaults to page 1 and size 36", () => {
  expect(parseCatalogPage({})).toEqual({ page: 1, pageSize: 36, offset: 0 });
  expect(parseCatalogPage({ page: "3" })).toEqual({ page: 3, pageSize: 36, offset: 72 });
});
```

- [ ] **Step 2: Implement + add `offset` param to `loadCatalogBrowse`**

Change default `limit` from caller's `500` to `36`. Add `offset = 0` parameter; apply `.slice(offset, offset + limit)` after sort.

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

---

### Task 9: Thumbnail signing + lazy images

**Files:**
- Modify: `apps/web/src/lib/feed/queries.ts`
- Modify: `apps/web/src/app/(app)/(shell)/catalog/page.tsx`
- Modify: `apps/web/src/components/feed/catalog-card.tsx`

- [ ] **Step 1: Add thumbnail transform to signImagePaths**

```ts
export async function signThumbnailPaths(
  supabase: SupabaseClient,
  paths: (string | null)[],
  width = 400,
): Promise<Map<string, string>> {
  const map = await signImagePaths(supabase, paths);
  // Append Supabase transform query: ?width=400&quality=75
  for (const [path, url] of map) {
    map.set(path, `${url}${url.includes("?") ? "&" : "?"}width=${width}&quality=75`);
  }
  return map;
}
```

- [ ] **Step 2: Catalog page — use pageSize 36, signThumbnailPaths, pass only current page paths**

Replace `loadCatalogBrowse(..., 500, ...)` with `loadCatalogBrowse(..., pageSize, filters, offset)`.

- [ ] **Step 3: Catalog card — add loading="lazy" on img; use thumb URL**

- [ ] **Step 4: Makers default** — when `q` is empty and `view` unset, redirect to `?view=makers` on first visit (or render makers inline)

- [ ] **Step 5: Add CatalogPagination component** — "Load more" appends via `?page=N` or use infinite scroll client wrapper

- [ ] **Step 6: Manual verify** — Network tab shows ≤36 images on first load, widths ~400px

- [ ] **Step 7: Commit**

```bash
git commit -m "perf(catalog): paginate grid and serve thumbnails"
```

---

## Phase 6 — Freshness mechanics

### Task 10: Daily rotation helper

**Files:**
- Create: `apps/web/src/lib/cellar/daily-rotation.ts`
- Create: `apps/web/src/lib/cellar/daily-rotation.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { rotateDaily } from "./daily-rotation";

describe("rotateDaily", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("is stable for same seed", () => {
    expect(rotateDaily(items, "member|2026-07-07|bourbon", 4)).toEqual(
      rotateDaily(items, "member|2026-07-07|bourbon", 4),
    );
  });

  it("returns at most limit items", () => {
    expect(rotateDaily(items, "x", 3)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Implement using fnv1a32 from daily-pour/select**

```ts
import { fnv1a32 } from "@/lib/daily-pour/select";

export function rotateDaily<T>(items: T[], seed: string, limit: number): T[] {
  if (items.length <= limit) return items;
  const start = fnv1a32(seed) % items.length;
  const rotated: T[] = [];
  for (let i = 0; i < limit; i += 1) {
    rotated.push(items[(start + i) % items.length]);
  }
  return rotated;
}
```

- [ ] **Step 3: Run test — expect PASS**

- [ ] **Step 4: Commit**

---

### Task 11: Try next rotation + pairing hints

**Files:**
- Create: `apps/web/src/lib/cellar/recent-tastings.ts`
- Modify: `apps/web/src/lib/find-next/load.ts`
- Modify: `apps/web/src/components/cellar/home-v2-sections.tsx`

- [ ] **Step 1: recent-tastings — query tastings in last 14 days, return Set of product_ids**

- [ ] **Step 2: In loadProductSuggestions — after sort, filter deprioritized to tail; apply rotateDaily on top 8 with seed `${memberId}|${date}|${productType}`**

- [ ] **Step 3: Add pairing hint to ProductCard** — for each try-next pick, load best opposite-type match from cellar via existing pairing engine; render small "Pairs with …" link

- [ ] **Step 4: Manual verify** — Try next differs day-to-day; recently tasted items sink

- [ ] **Step 5: Commit**

---

### Task 12: Hunt next lanes + Tonight shuffle

**Files:**
- Create: `apps/web/src/lib/catalog/fresh-drops.ts`
- Modify: `apps/web/src/lib/cellar/home-v2.ts`
- Modify: `apps/web/src/components/cellar/home-v2-sections.tsx`
- Create: `apps/web/src/components/cellar/tonight-shuffle-button.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/page.tsx`

- [ ] **Step 1: fresh-drops.ts** — query products where `created_at > now() - 60 days` OR `specs.enriched_at` within 60 days; filter by tier + preferences

- [ ] **Step 2: home-v2.ts** — split huntNext into `{ forYou, freshDrops, stretch }` arrays per spec mix ratios

- [ ] **Step 3: HuntNextRail** — render two labeled sub-sections or tabs

- [ ] **Step 4: Tonight shuffle** — client button increments rollIndex; server action or ?roll= param on refresh; exclude last 3 pairs from candidates in `loadTonightsPick`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(home): daily rotation, hunt lanes, tonight shuffle"
```

---

## Phase 7 — Onboarding sweep

### Task 13: Welcome flow NAV_MAP

**Files:**
- Modify: `apps/web/src/components/onboarding/welcome-flow.tsx`

- [ ] **Step 1: Update NAV_MAP labels**

```tsx
const NAV_MAP = [
  { label: "Cellar", line: "Tonight's pick and what to try next", icon: BookOpen },
  { label: "Shelf", line: "What you own, want, and have tried", icon: Layers },
  { label: "Capture", line: "Snap and log", icon: Plus, captureFab: true },
  { label: "Log", line: "Your tasting history", icon: Archive },
  { label: "You", line: "Your taste profile", icon: User },
];
```

- [ ] **Step 2: Manual verify onboarding step 3

- [ ] **Step 3: Commit**

---

## Final verification

- [ ] Run: `cd apps/web && pnpm test && pnpm typecheck && pnpm lint`
- [ ] Manual iPhone-width smoke:
  1. Open app → Cellar home with rails
  2. Shelf tab → Have/Want/Tried
  3. Log tab → merged timeline, filters
  4. You tab → profile, catalog link, no inventory
  5. Catalog from You → fast load, paginated
  6. `/pairings` → redirects to Log
  7. Shuffle tonight's pick
  8. Try next different after date change (or mock seed)

---

## Self-review

### Spec coverage
- Nav remix (Cellar · Shelf · Log · You): Tasks 1–2
- `/` stays concierge home: unchanged page.tsx, Task 12 shuffle
- `/shelf` standalone: Task 4
- `/log` merged timeline: Tasks 5–6
- `/you` taste profile: Task 7
- Catalog demoted + performance: Tasks 8–9
- Pairings demoted: Task 3 redirects, Task 6 visual cards
- Freshness (Try/Hunt/Tonight): Tasks 10–12
- Onboarding: Task 13

### Placeholder scan
- No TBD steps; all files named.

### Supersedes
- Do not execute `2026-07-03-personal-ia-reshuffle.md` Tasks that redirect `/` to `/you` or move concierge to You.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-07-07-evening-model-remix.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — implement phase-by-phase in this session with checkpoints

Which approach do you want?
