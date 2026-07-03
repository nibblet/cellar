# Personal IA Reshuffle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `You` the canonical home and concierge surface, split `Cellar` into a standalone collection page, make `/settings` canonical, and demote Pairings from primary navigation while explicitly deferring theme work.

**Architecture:** Introduce a small navigation-path contract in `apps/web/src/lib/navigation/paths.ts` so routes, redirects, auth exits, and revalidation targets stop hardcoding `/` as the content home. Reuse the existing cellar, taste, and pairing loaders, but extract the duplicated “Tonight’s pick” and “You poured last” logic into focused helpers/components so `/you` owns recommendation guidance and `/cellar` owns inventory management.

**Tech Stack:** Next.js 16 App Router (RSC + Server Actions), Supabase, Tailwind v4, TypeScript strict, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-07-03-personal-ia-reshuffle-design.md`

**Out of scope:** Theme rework. Do not change tokens, color hierarchy, typography, or decorative styling beyond what the route/section reshuffle requires.

**Run commands from:** `apps/web/`

**Core commands:**
- `pnpm test -- <file>` — targeted Vitest file
- `pnpm test` — full Vitest suite
- `pnpm typecheck` — TypeScript
- `pnpm lint` — Biome check

---

## File structure lock-in

### Create

- `apps/web/src/lib/navigation/paths.ts` — canonical route constants and post-auth/onboarding exit helpers.
- `apps/web/src/lib/navigation/paths.test.ts` — locks the canonical IA routes and redirects.
- `apps/web/src/app/(app)/(shell)/cellar/page.tsx` — new standalone collection page.
- `apps/web/src/app/(app)/(shell)/settings/settings-page.tsx` — shared settings page implementation so `/settings` can be canonical and `/you/settings` can become a redirect.
- `apps/web/src/components/nav/bottom-nav.test.tsx` — verifies the primary nav drops Pairings and points home at `You`.
- `apps/web/src/lib/you/last-activity.ts` — pure helper that formats “You poured/You lit … last.”
- `apps/web/src/lib/you/last-activity.test.ts` — unit tests for the helper.
- `apps/web/src/components/you/tonights-pick-section.tsx` — shared server component extracted from duplicated route-inline code.

### Modify

- `apps/web/src/components/nav/bottom-nav.tsx`
- `apps/web/src/app/(app)/(shell)/page.tsx`
- `apps/web/src/app/(app)/(shell)/you/page.tsx`
- `apps/web/src/app/(app)/(shell)/you/cellar/page.tsx`
- `apps/web/src/app/(app)/(shell)/shelf/page.tsx`
- `apps/web/src/app/(app)/(shell)/settings/page.tsx`
- `apps/web/src/app/(app)/(shell)/you/settings/page.tsx`
- `apps/web/src/app/(app)/(shell)/pairings/page.tsx`
- `apps/web/src/app/(app)/(shell)/pairings/capture/page.tsx`
- `apps/web/src/app/(auth)/login/actions.ts`
- `apps/web/src/app/(auth)/update-password/actions.ts`
- `apps/web/src/app/(app)/welcome/page.tsx`
- `apps/web/src/lib/onboarding/complete.ts`
- `apps/web/src/lib/cellar/actions.ts`
- `apps/web/src/app/(app)/(shell)/admin/catalog/actions.ts`
- `apps/web/src/app/(app)/(shell)/settings/actions.ts`
- `apps/web/src/app/(app)/(shell)/you/settings/actions.ts`
- `apps/web/src/app/not-found.tsx`
- `apps/web/src/app/(app)/(shell)/search/page.tsx`

---

## Task 1: Canonical navigation path contract

**Files:**
- Create: `apps/web/src/lib/navigation/paths.ts`
- Create: `apps/web/src/lib/navigation/paths.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/lib/navigation/paths.test.ts
import { describe, expect, it } from "vitest";
import {
  APP_HOME_PATH,
  CELLAR_PATH,
  PERSONAL_PAIRINGS_PATH,
  SETTINGS_PREFERENCES_PATH,
  SETTINGS_PATH,
  getOnboardingExitPath,
} from "./paths";

describe("navigation path contract", () => {
  it("locks the canonical personal IA routes", () => {
    expect(APP_HOME_PATH).toBe("/you");
    expect(CELLAR_PATH).toBe("/cellar");
    expect(SETTINGS_PATH).toBe("/settings");
    expect(PERSONAL_PAIRINGS_PATH).toBe("/you/pairings");
  });

  it("maps onboarding exits to the new canonical destinations", () => {
    expect(getOnboardingExitPath("capture")).toBe("/capture");
    expect(SETTINGS_PREFERENCES_PATH).toBe("/settings#preferences");
    expect(getOnboardingExitPath("preferences")).toBe(SETTINGS_PREFERENCES_PATH);
    expect(getOnboardingExitPath("lounge")).toBe("/you");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/lib/navigation/paths.test.ts`

Expected: FAIL with module-not-found for `./paths` and/or missing exports.

- [ ] **Step 3: Implement the navigation contract**

```ts
// apps/web/src/lib/navigation/paths.ts
import type { OnboardingExit } from "@/lib/onboarding/types";

export const APP_HOME_PATH = "/you";
export const CELLAR_PATH = "/cellar";
export const SETTINGS_PATH = "/settings";
export const SETTINGS_PREFERENCES_PATH = `${SETTINGS_PATH}#preferences`;
export const PERSONAL_TASTINGS_PATH = "/you/tastings";
export const PERSONAL_PAIRINGS_PATH = "/you/pairings";

export function getOnboardingExitPath(exit: OnboardingExit): string {
  switch (exit) {
    case "capture":
      return "/capture";
    case "preferences":
      return SETTINGS_PREFERENCES_PATH;
    case "lounge":
      return APP_HOME_PATH;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- src/lib/navigation/paths.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/navigation/paths.ts src/lib/navigation/paths.test.ts
git commit -m "refactor(nav): add canonical personal route contract"
```

---

## Task 2: Canonical shell routes and bottom nav

**Files:**
- Create: `apps/web/src/components/nav/bottom-nav.test.tsx`
- Create: `apps/web/src/app/(app)/(shell)/cellar/page.tsx`
- Create: `apps/web/src/app/(app)/(shell)/settings/settings-page.tsx`
- Modify: `apps/web/src/components/nav/bottom-nav.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/page.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/you/cellar/page.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/shelf/page.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/settings/page.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/you/settings/page.tsx`

- [ ] **Step 1: Write the failing nav test**

```tsx
// apps/web/src/components/nav/bottom-nav.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "./bottom-nav";

const mockedUsePathname = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: mockedUsePathname,
}));

describe("BottomNav", () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue("/you");
  });

  it("shows the new primary destinations and drops Pairings", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /you/i })).toHaveAttribute("href", "/you");
    expect(screen.getByRole("link", { name: /cellar/i })).toHaveAttribute("href", "/cellar");
    expect(screen.getByRole("link", { name: /catalog/i })).toHaveAttribute("href", "/catalog");
    expect(screen.queryByRole("link", { name: /pairings/i })).toBeNull();
  });

  it("marks You as the active home route", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /you/i })).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- src/components/nav/bottom-nav.test.tsx`

Expected: FAIL because the current nav still renders `Pairings` and points `Cellar` at `/`.

- [ ] **Step 3: Implement the canonical shell routes**

```tsx
// apps/web/src/components/nav/bottom-nav.tsx
import { Boxes, BookOpen, Plus, User } from "lucide-react";
import {
  APP_HOME_PATH,
  CELLAR_PATH,
} from "@/lib/navigation/paths";

const SIDE_ITEMS = [
  {
    href: APP_HOME_PATH,
    label: "You",
    icon: User,
    match: (p: string) => p === APP_HOME_PATH || p.startsWith("/you") || p.startsWith("/admin"),
  },
  {
    href: CELLAR_PATH,
    label: "Cellar",
    icon: BookOpen,
    match: (p: string) => p === CELLAR_PATH,
  },
  {
    href: "/catalog",
    label: "Catalog",
    icon: Boxes,
    match: (p: string) => p.startsWith("/catalog"),
  },
];
```

```tsx
// apps/web/src/app/(app)/(shell)/page.tsx
import { redirect } from "next/navigation";
import { APP_HOME_PATH } from "@/lib/navigation/paths";

export default function RootPersonalRedirect() {
  redirect(APP_HOME_PATH);
}
```

```tsx
// apps/web/src/app/(app)/(shell)/cellar/page.tsx
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { CellarSection } from "@/components/members/sections";
import { Divider } from "@/components/primitives";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CellarPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name_first, name_last_initial")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) redirect("/login");

  return (
    <AppShell>
      <header className="mb-5">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          {formatMemberName(profile as MemberNameFields)}
        </p>
        <h1 className="text-3xl mt-1">Your cellar</h1>
      </header>
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

```tsx
// apps/web/src/app/(app)/(shell)/settings/page.tsx
import { SettingsPage } from "./settings-page";

export default async function SettingsPageRoute() {
  return <SettingsPage />;
}
```

```tsx
// apps/web/src/app/(app)/(shell)/you/settings/page.tsx
import { redirect } from "next/navigation";
import { SETTINGS_PATH } from "@/lib/navigation/paths";

export default function LegacyYouSettingsRedirect() {
  redirect(SETTINGS_PATH);
}
```

```tsx
// apps/web/src/app/(app)/(shell)/you/cellar/page.tsx
import { redirect } from "next/navigation";
import { CELLAR_PATH } from "@/lib/navigation/paths";

export default function LegacyYouCellarRedirect() {
  redirect(CELLAR_PATH);
}
```

```tsx
// apps/web/src/app/(app)/(shell)/shelf/page.tsx
import { redirect } from "next/navigation";
import { CELLAR_PATH } from "@/lib/navigation/paths";

export default function ShelfRedirect() {
  redirect(CELLAR_PATH);
}
```

**For `settings/settings-page.tsx`:**
- Move the current page implementation out of `apps/web/src/app/(app)/(shell)/you/settings/page.tsx`.
- Keep the existing forms/components (`AvatarUploader`, `DisplayNameForm`, `MemberSinceEditor`, `ThemeToggle`, `PreferencesForm`) untouched.
- Keep the header text as `Settings`.

- [ ] **Step 4: Run the targeted tests**

Run: `pnpm test -- src/lib/navigation/paths.test.ts src/components/nav/bottom-nav.test.tsx`

Expected: PASS.

- [ ] **Step 5: Manual smoke-check the new shell**

1. Visit `/` while signed in → lands on `/you`.
2. Visit `/cellar` → shows Have / Want / Tried without `Tonight’s pick`, `Winston suggests`, or `Try next`.
3. Visit `/you/cellar` and `/shelf` → both land on `/cellar`.
4. Visit `/settings` → shows the existing settings page.
5. Visit `/you/settings` → lands on `/settings`.

- [ ] **Step 6: Commit**

```bash
git add \
  src/components/nav/bottom-nav.tsx \
  src/components/nav/bottom-nav.test.tsx \
  src/app/'(app)'/'(shell)'/page.tsx \
  src/app/'(app)'/'(shell)'/cellar/page.tsx \
  src/app/'(app)'/'(shell)'/shelf/page.tsx \
  src/app/'(app)'/'(shell)'/settings/page.tsx \
  src/app/'(app)'/'(shell)'/settings/settings-page.tsx \
  src/app/'(app)'/'(shell)'/you/cellar/page.tsx \
  src/app/'(app)'/'(shell)'/you/settings/page.tsx
git commit -m "refactor(nav): make You home and Cellar standalone"
```

---

## Task 3: Rewrite `/you` as the concierge home

**Files:**
- Create: `apps/web/src/lib/you/last-activity.ts`
- Create: `apps/web/src/lib/you/last-activity.test.ts`
- Create: `apps/web/src/components/you/tonights-pick-section.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/you/page.tsx`

- [ ] **Step 1: Write the failing tests for the last-activity helper**

```ts
// apps/web/src/lib/you/last-activity.test.ts
import { describe, expect, it } from "vitest";
import { buildLastActivityLine } from "./last-activity";

describe("buildLastActivityLine", () => {
  it("uses poured for bourbons", () => {
    expect(
      buildLastActivityLine({ type: "bourbon", name: "Eagle Rare 10" }),
    ).toBe('"You poured Eagle Rare 10 last."');
  });

  it("uses lit for cigars", () => {
    expect(
      buildLastActivityLine({ type: "cigar", name: "Padron 1964" }),
    ).toBe('"You lit Padron 1964 last."');
  });

  it("returns null when no product exists", () => {
    expect(buildLastActivityLine(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/lib/you/last-activity.test.ts`

Expected: FAIL with module-not-found for `./last-activity`.

- [ ] **Step 3: Implement the helper and extract `Tonight's pick`**

```ts
// apps/web/src/lib/you/last-activity.ts
export type LastActivityProduct = {
  type: "cigar" | "bourbon";
  name: string;
};

export function buildLastActivityLine(product: LastActivityProduct | null): string | null {
  if (!product) return null;
  return product.type === "bourbon"
    ? `"You poured ${product.name} last."`
    : `"You lit ${product.name} last."`;
}
```

```tsx
// apps/web/src/components/you/tonights-pick-section.tsx
import Link from "next/link";
import { Divider, Voice } from "@/components/primitives";
import { todayKey } from "@/lib/daily-pour/select";
import { loadPickPourCandidates } from "@/lib/pick-pour/load";
import { selectPickPour } from "@/lib/pick-pour/select";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type ProductRow = { id: string; name: string; brand: string | null; type: string };

export async function TonightsPickSection({ memberId }: { memberId: string }) {
  const supabase = await createSupabaseServerClient();
  const candidates = await loadPickPourCandidates(supabase, memberId);
  const pick = selectPickPour({ memberId, date: todayKey(), rollIndex: 0 }, candidates);
  if (!pick) return null;

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, type")
    .in("id", [pick.cigar_id, pick.bourbon_id]);

  const rows = (products as ProductRow[] | null) ?? [];
  const cigar = rows.find((p) => p.type === "cigar");
  const bourbon = rows.find((p) => p.type === "bourbon");
  if (!cigar || !bourbon) return null;

  const cigarDisplay = cigar.brand ? `${cigar.brand} ${cigar.name}` : cigar.name;
  const bourbonDisplay = bourbon.brand ? `${bourbon.brand} ${bourbon.name}` : bourbon.name;
  const day = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  });
  const line = `"For a ${day} on the porch: ${cigarDisplay} with the ${bourbonDisplay}."`;

  return (
    <section className="mb-5">
      <Divider label="Tonight's pick" />
      <Voice className="block mb-2">{line}</Voice>
      <Link
        href={`/pairings/${pick.cigar_id}/${pick.bourbon_id}`}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[12px] transition-colors",
          "h-12 px-5 text-base",
          "bg-surface text-foreground-muted border border-border hover:bg-surface-2",
        )}
      >
        See the pairing →
      </Link>
    </section>
  );
}
```

```tsx
// apps/web/src/app/(app)/(shell)/you/page.tsx
import { Suspense } from "react";
import { CellarInsightCard, CellarInsightSkeleton, TonightsPickSkeleton, TryNext, TryNextSkeleton } from "@/components/cellar";
import { AppShell } from "@/components/layout/app-shell";
import { Card, Divider, Voice } from "@/components/primitives";
import { ensureTasteRecommendations } from "@/lib/taste";
import { loadCachedInsight } from "@/lib/cellar/insight";
import { TonightsPickSection } from "@/components/you/tonights-pick-section";
import { buildLastActivityLine } from "@/lib/you/last-activity";
import {
  CELLAR_PATH,
  PERSONAL_PAIRINGS_PATH,
  PERSONAL_TASTINGS_PATH,
  SETTINGS_PATH,
} from "@/lib/navigation/paths";

const me = auth.user.id;
const [cachedInsight, recommendations] = await Promise.all([
  loadCachedInsight(supabase, me),
  ensureTasteRecommendations(supabase, me),
]);

const lastLine = buildLastActivityLine(
  lastTasting?.product
    ? { type: lastTasting.product.type, name: lastTasting.product.name }
    : null,
);

return (
  <AppShell>
    <header className="mb-6 flex flex-col items-center text-center">
      <h1 className="text-3xl">You</h1>
      <p className="text-sm tracking-widest uppercase text-foreground-subtle mt-1">{displayName}</p>
    </header>

    {lastLine ? <Voice className="block mb-4 text-sm">{lastLine}</Voice> : null}

    <Suspense fallback={<TonightsPickSkeleton />}>
      <TonightsPickSection memberId={me} />
    </Suspense>

    {cachedInsight ? (
      <>
        <Divider label="Winston suggests" />
        <CellarInsightCard insight={cachedInsight} />
      </>
    ) : null}

    {recommendations.cigars.length > 0 || recommendations.bourbons.length > 0 ? (
      <>
        <Divider label="Try next" />
        <TryNext cigars={recommendations.cigars} bourbons={recommendations.bourbons} />
      </>
    ) : null}

    <Divider label="Your archive" />
    <div className="flex flex-col gap-3">
      <PersonalCard
        title="Your cellar"
        counts={cellarCounts}
        thumbs={cellarThumbs}
        href={CELLAR_PATH}
        emptyVoice='"The shelf is bare. Mark a few on hand."'
        insightTeaser={cachedInsight?.bourbons ?? cachedInsight?.cigars ?? null}
      />
      <PersonalCard
        title="Your tastings"
        counts={tastingsCountStr}
        thumbs={tastingThumbs}
        href={PERSONAL_TASTINGS_PATH}
        emptyVoice='"Nothing logged yet. Snap something next time you light up."'
      />
      <PersonalCard
        title="Your pairings"
        counts={pairingsCountStr}
        thumbs={pairingThumbs}
        href={PERSONAL_PAIRINGS_PATH}
        emptyVoice='"No pairings captured yet. Pick a cigar and a pour."'
      />
    </div>

    <Divider label="Account" />
    <Card className="mb-3">
      <Link href={SETTINGS_PATH} className="block text-base text-foreground hover:text-foreground-muted">
        Settings & preferences →
      </Link>
    </Card>
  </AppShell>
);
```

**Required `/you` behavior after the rewrite:**
- The first actionable content is the concierge stack, not the profile/archive cards.
- `PersonalCard` links use `CELLAR_PATH`, `PERSONAL_TASTINGS_PATH`, `PERSONAL_PAIRINGS_PATH`, and `SETTINGS_PATH`.
- Keep `CellarInsightCard` and `TryNext` as existing components; only move them to the right page and label them for the concierge role.
- Do **not** move Have / Want / Tried inventory UI back onto `/you`.

- [ ] **Step 4: Run the targeted tests**

Run: `pnpm test -- src/lib/you/last-activity.test.ts`

Expected: PASS.

- [ ] **Step 5: Manual verification**

1. `/you` opens first after `/`.
2. The first text line is `You poured … last.` or `You lit … last.` when tasting history exists.
3. `Tonight’s pick`, `Winston suggests`, and `Try next` all live on `/you`.
4. The Cellar shortcut from `/you` lands on `/cellar`, not `/you/cellar`.
5. `Cellar` itself no longer contains the concierge modules.

- [ ] **Step 6: Commit**

```bash
git add \
  src/lib/you/last-activity.ts \
  src/lib/you/last-activity.test.ts \
  src/components/you/tonights-pick-section.tsx \
  src/app/'(app)'/'(shell)'/you/page.tsx
git commit -m "refactor(you): move concierge guidance onto home"
```

---

## Task 4: Demote Pairings and sweep path assumptions

**Files:**
- Modify: `apps/web/src/app/(app)/(shell)/pairings/page.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/pairings/capture/page.tsx`
- Modify: `apps/web/src/app/(auth)/login/actions.ts`
- Modify: `apps/web/src/app/(auth)/update-password/actions.ts`
- Modify: `apps/web/src/app/(app)/welcome/page.tsx`
- Modify: `apps/web/src/lib/onboarding/complete.ts`
- Modify: `apps/web/src/lib/cellar/actions.ts`
- Modify: `apps/web/src/app/(app)/(shell)/admin/catalog/actions.ts`
- Modify: `apps/web/src/app/(app)/(shell)/settings/actions.ts`
- Modify: `apps/web/src/app/(app)/(shell)/you/settings/actions.ts`
- Modify: `apps/web/src/app/not-found.tsx`
- Modify: `apps/web/src/app/(app)/(shell)/search/page.tsx`
- Modify: `apps/web/src/lib/navigation/paths.ts`
- Modify: `apps/web/src/lib/navigation/paths.test.ts`

- [ ] **Step 1: Expand the path test for post-auth entry points**

```ts
// append to apps/web/src/lib/navigation/paths.test.ts
import { PAIRINGS_INDEX_REDIRECT_PATH } from "./paths";

it("locks the canonical pairings redirect target", () => {
  expect(PAIRINGS_INDEX_REDIRECT_PATH).toBe("/you/pairings");
});
```

- [ ] **Step 2: Run the path test**

Run: `pnpm test -- src/lib/navigation/paths.test.ts`

Expected: FAIL because `PAIRINGS_INDEX_REDIRECT_PATH` is not exported yet.

- [ ] **Step 3: Implement the path sweep**

```ts
// apps/web/src/lib/navigation/paths.ts
export const PAIRINGS_INDEX_REDIRECT_PATH = PERSONAL_PAIRINGS_PATH;
```

```tsx
// apps/web/src/app/(app)/(shell)/pairings/page.tsx
import { redirect } from "next/navigation";
import { PAIRINGS_INDEX_REDIRECT_PATH } from "@/lib/navigation/paths";

export default function PairingsIndexRedirect() {
  redirect(PAIRINGS_INDEX_REDIRECT_PATH);
}
```

```tsx
// apps/web/src/app/(app)/(shell)/pairings/capture/page.tsx
import { PERSONAL_PAIRINGS_PATH } from "@/lib/navigation/paths";

<Link href={PERSONAL_PAIRINGS_PATH} className="text-sm text-foreground-muted hover:text-foreground">
  ← Your pairings
</Link>
```

```ts
// apps/web/src/app/(auth)/login/actions.ts
import { APP_HOME_PATH } from "@/lib/navigation/paths";

redirect(APP_HOME_PATH);
```

```ts
// apps/web/src/app/(auth)/update-password/actions.ts
import { APP_HOME_PATH } from "@/lib/navigation/paths";

redirect(APP_HOME_PATH);
```

```ts
// apps/web/src/lib/onboarding/complete.ts
import { getOnboardingExitPath } from "@/lib/navigation/paths";

redirect(getOnboardingExitPath(exit));
```

```tsx
// apps/web/src/app/(app)/welcome/page.tsx
import { APP_HOME_PATH } from "@/lib/navigation/paths";

if (profile && !needsOnboarding(profile)) {
  redirect(APP_HOME_PATH);
}
```

```ts
// apps/web/src/lib/cellar/actions.ts
import { APP_HOME_PATH, CELLAR_PATH } from "@/lib/navigation/paths";

revalidatePath(`/products/${productId}`);
revalidatePath(CELLAR_PATH);
revalidatePath(APP_HOME_PATH);
```

```ts
// apps/web/src/app/(app)/(shell)/settings/actions.ts
import { APP_HOME_PATH, SETTINGS_PATH } from "@/lib/navigation/paths";

revalidatePath(SETTINGS_PATH);
revalidatePath(APP_HOME_PATH);
```

```ts
// apps/web/src/app/(app)/(shell)/you/settings/actions.ts
import { APP_HOME_PATH, SETTINGS_PATH } from "@/lib/navigation/paths";

revalidatePath(APP_HOME_PATH);
revalidatePath(SETTINGS_PATH);
```

```ts
// apps/web/src/app/(app)/(shell)/admin/catalog/actions.ts
import { APP_HOME_PATH } from "@/lib/navigation/paths";

revalidatePath("/admin/catalog");
revalidatePath(APP_HOME_PATH);
```

```tsx
// apps/web/src/app/not-found.tsx
import { APP_HOME_PATH } from "@/lib/navigation/paths";

<Link href={APP_HOME_PATH}>Back to You</Link>
```

```tsx
// apps/web/src/app/(app)/(shell)/search/page.tsx
import { APP_HOME_PATH } from "@/lib/navigation/paths";

<Link href={APP_HOME_PATH} className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground mb-4">
  <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
</Link>
```

- [ ] **Step 4: Run focused regression checks**

Run: `pnpm test -- src/lib/navigation/paths.test.ts src/components/nav/bottom-nav.test.tsx src/lib/you/last-activity.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the repo-wide safety net**

Run: `pnpm test && pnpm typecheck && pnpm lint`

Expected: All PASS.

- [ ] **Step 6: Manual verification**

1. Sign in from `/login` → lands on `/you`.
2. Finish password reset → lands on `/you`.
3. Complete onboarding with `lounge` exit → lands on `/you`; `preferences` exit → lands on `/settings#preferences`.
4. Open `/pairings` directly → lands on `/you/pairings`.
5. Open Pairing Capture → back link points to your pairings archive.
6. Toggle Cellar state on a product → `/products/[id]`, `/cellar`, and `/you` all refresh correctly.
7. Save settings/preferences → `/settings` and `/you` both reflect the change.
8. Search page back link and 404 back link both return to `/you`.

- [ ] **Step 7: Commit**

```bash
git add \
  src/app/'(app)'/'(shell)'/pairings/page.tsx \
  src/app/'(app)'/'(shell)'/pairings/capture/page.tsx \
  src/app/'(auth)'/login/actions.ts \
  src/app/'(auth)'/update-password/actions.ts \
  src/app/'(app)'/welcome/page.tsx \
  src/lib/onboarding/complete.ts \
  src/lib/cellar/actions.ts \
  src/app/'(app)'/'(shell)'/admin/catalog/actions.ts \
  src/app/'(app)'/'(shell)'/settings/actions.ts \
  src/app/'(app)'/'(shell)'/you/settings/actions.ts \
  src/app/not-found.tsx \
  src/app/'(app)'/'(shell)'/search/page.tsx \
  src/lib/navigation/paths.test.ts
git commit -m "refactor(flow): demote pairings and retarget personal entrypoints"
```

---

## Self-review checklist

### Spec coverage
- `You` is the front door: covered by Task 2 (`/` redirect) and Task 3 (`/you` rewrite).
- `Cellar` stands alone as collection-only: covered by Task 2 (`/cellar`) and Task 3 (removing concierge modules from cellar ownership).
- `Settings` becomes canonical personalization page: covered by Task 2 (`settings-page.tsx`, `/you/settings` redirect) and Task 4 (revalidation/path sweep).
- `Pairings` becomes secondary: covered by Task 4 (`/pairings` redirect, archive through `/you/pairings`).
- Theme rework deferred: explicitly out of scope in this plan.

### Placeholder scan
- No placeholder markers or undefined file references remain.

### Type consistency
- Canonical route names stay `APP_HOME_PATH`, `CELLAR_PATH`, `SETTINGS_PATH`, `PERSONAL_TASTINGS_PATH`, `PERSONAL_PAIRINGS_PATH`.
- The last-activity helper uses only `"cigar" | "bourbon"` because those are the only product types in this app.

