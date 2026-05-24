# You Hub Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real `/you` hub: badge hero with always-visible labels, Winston one-liner, personal Cellar + Tastings cards, unified `/you/settings` (adds avatar upload + display-name edit), full `/you/cellar` + `/you/tastings` views sharing rendering with the existing Members profile tabs, and `/members/[me]` → `/you` redirects.

**Architecture:** All routes are Next.js 16 App Router Server Components in `apps/web/src/app/(app)/you/`. Data fetched in parallel via Supabase server client. Shared Cellar / Tastings section components live in `components/members/sections/` so both `/you/*` and `/members/[other]` reuse them. Forms use Server Actions with `useActionState`. Avatars go to a new `avatars` Supabase storage bucket, signed on render.

**Tech Stack:** Next.js 16 (RSC + Server Actions), Supabase (Postgres + Storage + RLS), Tailwind v4, TypeScript strict, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-05-24-you-hub-redesign-design.md`. Read it before starting.

**Working principles:**
- iPhone-first (375 / 390 / 430 viewports).
- Brass = single primary action per screen; no other element gets accent color on `/you`.
- Etched `<Divider label="..." />` at every major section break.
- Identity display: always `formatMemberName(user)` → `"First L"`.
- Self-documenting names over comments. Comments only where WHY is non-obvious.
- Commit after every passing test step.

**Lint/test commands** (run from `apps/web/`):
- `pnpm test -- <path>` — vitest, single file
- `pnpm test` — vitest, full suite
- `pnpm lint` — biome check
- `pnpm typecheck` — tsc --noEmit
- `pnpm dev` — local dev server

---

## Task 1: Migration — `users.avatar_url` column + `avatars` storage bucket

**Files:**
- Create: `supabase/migrations/20260524000001_you_hub_avatars.sql`

- [ ] **Step 1: Write the migration**

```sql
-- WS4: avatar uploads for the /you hub.
-- Stores the storage object path (NOT a signed URL). Render layer signs on demand.

alter table public.users
  add column if not exists avatar_url text;

-- Storage bucket. Private; signed-URL access only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  4 * 1024 * 1024,                -- 4 MB cap (client compresses to ~512px square JPEG)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Path convention: <auth.uid>/<filename>. The first folder segment must
-- equal the uploader's uid — same pattern as product-photos.

create policy "members upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "members update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "members delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- All members can read any avatar (we render avatars in MemberTag etc.).
create policy "members read any avatar"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: New migration listed, no errors. `users` table now has `avatar_url`. `avatars` bucket exists in Studio.

- [ ] **Step 3: Manual verification in Supabase Studio**

1. Storage → confirm `avatars` bucket exists with 4MB limit + allowed mime types.
2. Storage → Policies → confirm 4 policies on `storage.objects` referencing `avatars`.
3. SQL Editor → `select column_name from information_schema.columns where table_name='users' and column_name='avatar_url';` returns one row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260524000001_you_hub_avatars.sql
git commit -m "feat(db): users.avatar_url + avatars storage bucket (WS4)"
```

---

## Task 2: `lib/badges/next.ts` — compute the next-achievable badge

**Files:**
- Create: `apps/web/src/lib/badges/next.ts`
- Create: `apps/web/src/lib/badges/next.test.ts`

**Background:** Existing `compute.ts` derives **earned** badges from full-club data. We need a per-member function that returns the one closest-unearned badge plus a human gap label, computed from the SAME inputs `loadMemberBadges` already loads — no new queries.

Achievable-by-count badges (gap is calculable):
- `tenth-contribution` — gap = `10 - tastingCount(member)`
- `first-light` / `first-pour` / `first-smoke` — gap = "1 tasting" if member has zero matching tastings AND the badge is unclaimed (no other member earned it yet)

Not achievable on demand (omit from "next"): `founder` (date-gated past), `host` (requires event hosting), `validator` (event-specific), `winstons-choice` (requires Winston narration).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/lib/badges/next.test.ts
import { describe, expect, it } from "vitest";
import type { BadgeComputeInput } from "./compute";
import { nextBadgeForMember } from "./next";

const members = [
  { id: "alice", joined_at: "2026-01-01T00:00:00Z" },
  { id: "bob", joined_at: "2026-01-15T00:00:00Z" },
];

function input(overrides: Partial<BadgeComputeInput> = {}): BadgeComputeInput {
  return { members, tastings: [], events: [], winstonPairs: [], ...overrides };
}

describe("nextBadgeForMember", () => {
  it("returns first-light for a member with zero tastings when no one has it", () => {
    const next = nextBadgeForMember(input(), "alice");
    expect(next?.badge.id).toBe("first-light");
    expect(next?.gap).toBe("1 tasting");
  });

  it("returns tenth-contribution gap based on remaining tastings", () => {
    const tastings = Array.from({ length: 4 }, (_, i) => ({
      user_id: "alice",
      product_id: `p${i}`,
      product_type: "bourbon" as const,
      recommend: true,
      created_at: `2026-03-0${i + 1}T00:00:00Z`,
      event_id: null,
    }));
    const next = nextBadgeForMember(input({ tastings }), "alice");
    expect(next?.badge.id).toBe("tenth-contribution");
    expect(next?.gap).toBe("6 to go");
  });

  it("skips first-light if another member already claimed it", () => {
    const tastings = [
      {
        user_id: "bob",
        product_id: "p1",
        product_type: "cigar" as const,
        recommend: true,
        created_at: "2026-02-01T00:00:00Z",
        event_id: null,
      },
    ];
    const next = nextBadgeForMember(input({ tastings }), "alice");
    // first-light claimed by bob; alice's next achievable is first-pour or first-smoke
    expect(["first-pour", "first-smoke"]).toContain(next?.badge.id);
  });

  it("returns null when nothing remains achievable", () => {
    const tastings = Array.from({ length: 10 }, (_, i) => ({
      user_id: "alice",
      product_id: `p${i}`,
      product_type: (i % 2 === 0 ? "bourbon" : "cigar") as "bourbon" | "cigar",
      recommend: true,
      created_at: `2026-03-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      event_id: null,
    }));
    // alice has 10 tastings, first-light/pour/smoke, tenth-contribution all earned.
    const next = nextBadgeForMember(input({ tastings }), "alice");
    expect(next).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test -- src/lib/badges/next.test.ts`
Expected: FAIL — `nextBadgeForMember is not a function` / module not found.

- [ ] **Step 3: Implement `nextBadgeForMember`**

```ts
// apps/web/src/lib/badges/next.ts
import type { BadgeComputeInput } from "./compute";
import { computeMemberBadges } from "./compute";
import { type MemberBadge, MEMBER_BADGES, type MemberBadgeId } from "./definitions";

export type NextBadge = {
  badge: MemberBadge;
  gap: string;
};

const COUNT_DRIVEN: MemberBadgeId[] = [
  "first-light",
  "first-smoke",
  "first-pour",
  "tenth-contribution",
];

export function nextBadgeForMember(
  input: BadgeComputeInput,
  memberId: string,
): NextBadge | null {
  const earnedByMember = computeMemberBadges(input);
  const earned = new Set(earnedByMember.get(memberId) ?? []);

  const tastingCount = input.tastings.filter((t) => t.user_id === memberId).length;
  const hasBourbon = input.tastings.some(
    (t) => t.user_id === memberId && t.product_type === "bourbon",
  );
  const hasCigar = input.tastings.some(
    (t) => t.user_id === memberId && t.product_type === "cigar",
  );
  const hasRecommend = input.tastings.some((t) => t.user_id === memberId && t.recommend);

  // Track which first-* badges are still unclaimed across the whole club.
  const allEarned = new Set<MemberBadgeId>();
  for (const list of earnedByMember.values()) {
    for (const id of list) allEarned.add(id);
  }

  const candidates: NextBadge[] = [];

  if (!earned.has("first-light") && !allEarned.has("first-light") && !hasRecommend) {
    candidates.push({ badge: MEMBER_BADGES["first-light"], gap: "1 tasting" });
  }
  if (!earned.has("first-smoke") && !allEarned.has("first-smoke") && !hasCigar) {
    candidates.push({ badge: MEMBER_BADGES["first-smoke"], gap: "1 cigar" });
  }
  if (!earned.has("first-pour") && !allEarned.has("first-pour") && !hasBourbon) {
    candidates.push({ badge: MEMBER_BADGES["first-pour"], gap: "1 bourbon" });
  }
  if (!earned.has("tenth-contribution")) {
    const remaining = 10 - tastingCount;
    if (remaining > 0) {
      candidates.push({
        badge: MEMBER_BADGES["tenth-contribution"],
        gap: `${remaining} to go`,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Pick the smallest-gap candidate; tie-break by COUNT_DRIVEN order.
  return candidates.sort((a, b) => {
    const ga = numericGap(a.gap);
    const gb = numericGap(b.gap);
    if (ga !== gb) return ga - gb;
    return COUNT_DRIVEN.indexOf(a.badge.id) - COUNT_DRIVEN.indexOf(b.badge.id);
  })[0];
}

function numericGap(gap: string): number {
  const match = gap.match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test -- src/lib/badges/next.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/badges/next.ts apps/web/src/lib/badges/next.test.ts
git commit -m "feat(badges): nextBadgeForMember helper for /you hero (WS4)"
```

---

## Task 3: `MemberBadges` — add `"hero"` variant with always-visible labels

**Files:**
- Modify: `apps/web/src/components/members/member-badges.tsx`
- Create: `apps/web/src/components/members/member-badges.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/members/member-badges.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemberBadges } from "./member-badges";
import { MEMBER_BADGES } from "@/lib/badges/definitions";

describe("MemberBadges variant=hero", () => {
  it("renders the label visibly under each badge", () => {
    const { getByText } = render(
      <MemberBadges badges={[MEMBER_BADGES.founder]} variant="hero" />,
    );
    // sr-only span exists in other variants; hero variant promotes the label
    // to a visible element.
    const label = getByText("Founder");
    expect(label.className).not.toMatch(/sr-only/);
  });

  it("includes the mark glyph", () => {
    const { getByText } = render(
      <MemberBadges badges={[MEMBER_BADGES.founder]} variant="hero" />,
    );
    expect(getByText("F")).toBeTruthy();
  });
});
```

(`@testing-library/react` and `jsdom` are already installed and `vitest.config.ts` already sets `environment: "jsdom"`. No setup needed.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/components/members/member-badges.test.tsx`
Expected: FAIL — `variant="hero"` not handled; label is still `sr-only`.

- [ ] **Step 3: Add the hero variant**

```tsx
// apps/web/src/components/members/member-badges.tsx
import type { MemberBadge } from "@/lib/badges/definitions";
import { cn } from "@/lib/utils";

type MemberBadgesProps = {
  badges: MemberBadge[];
  className?: string;
  /**
   * - "inline"  — compact roster glyphs, label via title only
   * - "profile" — larger glyphs on member profile header, label via title only
   * - "hero"    — /you hub: glyph + always-visible label below, no tap needed
   */
  variant?: "inline" | "profile" | "hero";
};

export function MemberBadges({ badges, className, variant = "inline" }: MemberBadgesProps) {
  if (badges.length === 0) return null;

  if (variant === "hero") {
    return (
      <span className={cn("inline-flex items-start gap-3 flex-wrap", className)}>
        {badges.map((badge) => (
          <span key={badge.id} className="inline-flex flex-col items-center gap-1 w-12">
            <span
              title={badge.hint}
              className="inline-flex items-center justify-center rounded-full border border-border bg-surface-2 text-foreground-muted font-medium tabular-nums min-w-[1.75rem] h-7 px-1.5 text-[11px] tracking-wide"
            >
              <span aria-hidden="true">{badge.mark}</span>
              <span className="sr-only">{badge.label}</span>
            </span>
            <span className="text-[9px] uppercase tracking-widest text-foreground-subtle text-center leading-tight">
              {badge.label}
            </span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1 flex-wrap", className)}>
      {badges.map((badge) => (
        <span
          key={badge.id}
          title={badge.hint}
          className={cn(
            "inline-flex items-center justify-center rounded-full border border-border bg-surface-2 text-foreground-muted font-medium tabular-nums",
            variant === "inline"
              ? "min-w-[1.25rem] h-5 px-1 text-[9px] tracking-wide"
              : "min-w-[1.5rem] h-6 px-1.5 text-[10px] tracking-wide",
          )}
        >
          <span aria-hidden="true">{badge.mark}</span>
          <span className="sr-only">{badge.label}</span>
        </span>
      ))}
    </span>
  );
}

export function MemberNameWithBadges({
  name,
  badges,
  className,
}: {
  name: string;
  badges: MemberBadge[];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 min-w-0", className)}>
      <span className="truncate">{name}</span>
      <MemberBadges badges={badges} />
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/components/members/member-badges.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/members/member-badges.tsx apps/web/src/components/members/member-badges.test.tsx
git commit -m "feat(badges): hero variant with always-visible labels (WS4)"
```

---

## Task 4: Extract Cellar + Tastings sections into shared components

**Files:**
- Create: `apps/web/src/components/members/sections/cellar-section.tsx`
- Create: `apps/web/src/components/members/sections/tastings-section.tsx`
- Create: `apps/web/src/components/members/sections/index.ts`
- Modify: `apps/web/src/app/(app)/members/[id]/page.tsx`

**Why:** `/you/cellar`, `/you/tastings`, and `/members/[other]` all need the same rendering. Lift `CellarSection` and `TastingsSection` (currently inlined inside `members/[id]/page.tsx` lines 81-155) out to shared components.

- [ ] **Step 1: Create the shared `TastingsSection`**

```tsx
// apps/web/src/components/members/sections/tastings-section.tsx
import { TastingCard } from "@/components/feed";
import { Card, Divider } from "@/components/primitives";
import { loadFeed, signImagePaths } from "@/lib/feed/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function TastingsSection({
  memberId,
  displayName,
}: {
  memberId: string;
  displayName: string;
}) {
  const supabase = await createSupabaseServerClient();
  const entries = await loadFeed(supabase, { userId: memberId, limit: 100 });
  const signed = await signImagePaths(
    supabase,
    entries.map((e) => e.hero_image_path),
  );

  const total = entries.length;
  const recommended = entries.filter((e) => e.recommend).length;

  return (
    <>
      <p className="text-sm text-foreground-muted mb-4">
        {total} tasting{total === 1 ? "" : "s"}
        {recommended > 0 ? ` · ${recommended} recommended` : ""}
      </p>

      <Divider label="The archive" />

      {entries.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground-subtle">
            {displayName} hasn't logged a tasting yet.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <TastingCard
              key={entry.tasting_id}
              entry={entry}
              signedHero={
                entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create the shared `CellarSection`**

```tsx
// apps/web/src/components/members/sections/cellar-section.tsx
import { CellarTab } from "@/components/cellar";
import { loadCellarProducts } from "@/lib/cellar/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function CellarSection({
  memberId,
  memberFirstName,
  isOwnProfile,
}: {
  memberId: string;
  memberFirstName: string;
  isOwnProfile: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const [have, want, tried] = await Promise.all([
    loadCellarProducts(supabase, memberId, "have"),
    loadCellarProducts(supabase, memberId, "want"),
    loadCellarProducts(supabase, memberId, "tried"),
  ]);

  return (
    <CellarTab
      have={have}
      want={want}
      tried={tried}
      isOwnProfile={isOwnProfile}
      memberFirstName={memberFirstName}
    />
  );
}
```

- [ ] **Step 3: Create the barrel export**

```ts
// apps/web/src/components/members/sections/index.ts
export { CellarSection } from "./cellar-section";
export { TastingsSection } from "./tastings-section";
```

- [ ] **Step 4: Refactor `members/[id]/page.tsx` to consume the shared sections**

Replace the inlined `TastingsSection` (lines 81-128) and `CellarSection` (lines 130-155) with imports from the new barrel. The file should now look like:

```tsx
// apps/web/src/app/(app)/members/[id]/page.tsx
import { notFound } from "next/navigation";
import { MemberBadges } from "@/components/members";
import { CellarSection, TastingsSection } from "@/components/members/sections";
import { badgesForMember, loadMemberBadges } from "@/lib/badges/load";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string }>;

type ProfileTab = "tastings" | "cellar";

function parseProfileTab(raw: string | undefined): ProfileTab {
  return raw === "cellar" ? "cellar" : "tastings";
}

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { tab: tabRaw } = await searchParams;
  const tab = parseProfileTab(tabRaw);

  const supabase = await createSupabaseServerClient();

  const [memberResult, authResult, badgeMap] = await Promise.all([
    supabase
      .from("users")
      .select("id, name_first, name_last_initial, joined_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.auth.getUser(),
    loadMemberBadges(supabase),
  ]);

  if (!memberResult.data) notFound();

  const member = memberResult.data;
  const profile = member as MemberNameFields & { id: string; joined_at: string };
  const viewerId = authResult.data.user?.id ?? null;
  const isOwnProfile = viewerId === id;
  const badges = badgesForMember(badgeMap, id);

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-5">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Member</p>
        <h1 className="text-3xl mt-1">{formatMemberName(profile)}</h1>
        {badges.length > 0 ? (
          <MemberBadges badges={badges} variant="profile" className="mt-3" />
        ) : null}
      </header>

      <div className="flex items-center gap-2 mb-5 border-b border-border">
        <TabLink label="Tastings" href={`/members/${id}`} active={tab === "tastings"} />
        <TabLink label="Cellar" href={`/members/${id}?tab=cellar`} active={tab === "cellar"} />
      </div>

      {tab === "cellar" ? (
        <CellarSection
          memberId={id}
          memberFirstName={member.name_first}
          isOwnProfile={isOwnProfile}
        />
      ) : (
        <TastingsSection memberId={id} displayName={formatMemberName(profile)} />
      )}
    </main>
  );
}

function TabLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? "border-accent text-foreground"
          : "border-transparent text-foreground-muted hover:text-foreground"
      }`}
    >
      {label}
    </a>
  );
}
```

- [ ] **Step 5: Smoke test the refactor**

Run: `pnpm --filter web typecheck && pnpm --filter web test`
Expected: typecheck passes; full test suite passes (no regressions from extraction).

Manual: visit `/members/<any-other-id>` and toggle the Tastings / Cellar tabs. Rendering identical to pre-refactor.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/members/sections/ apps/web/src/app/\(app\)/members/\[id\]/page.tsx
git commit -m "refactor(members): extract Cellar/Tastings sections to shared components (WS4)"
```

---

## Task 5: Server action — `updateDisplayName`

**Files:**
- Create: `apps/web/src/app/(app)/you/settings/actions.ts`

**Why:** Members currently can't edit their display name. This adds the action that the form will consume.

- [ ] **Step 1: Implement `updateDisplayName`**

```ts
// apps/web/src/app/(app)/you/settings/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DisplayNameFormState = {
  ok: boolean;
  message: string | null;
};

export async function updateDisplayName(
  _prev: DisplayNameFormState,
  formData: FormData,
): Promise<DisplayNameFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Not signed in." };

  const firstRaw = formData.get("name_first");
  const initialRaw = formData.get("name_last_initial");

  const nameFirst = typeof firstRaw === "string" ? firstRaw.trim() : "";
  const initialRawStr = typeof initialRaw === "string" ? initialRaw.trim() : "";
  // Last initial is a single uppercase letter. Empty allowed for single-name members.
  const nameLastInitial = initialRawStr.charAt(0).toUpperCase();

  if (nameFirst.length === 0 || nameFirst.length > 40) {
    return { ok: false, message: "First name must be 1-40 characters." };
  }
  if (initialRawStr.length > 0 && !/^[A-Za-z]$/.test(initialRawStr.charAt(0))) {
    return { ok: false, message: "Last initial must be a single letter." };
  }

  const { error } = await supabase
    .from("users")
    .update({ name_first: nameFirst, name_last_initial: nameLastInitial })
    .eq("id", auth.user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/you");
  revalidatePath("/you/settings");
  revalidatePath("/members");
  return { ok: true, message: "Saved." };
}

export type AvatarFormState = {
  ok: boolean;
  message: string | null;
};

export async function uploadAvatar(
  _prev: AvatarFormState,
  formData: FormData,
): Promise<AvatarFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Not signed in." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Please choose an image." };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, message: "Image must be under 4 MB." };
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${auth.user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { ok: false, message: uploadError.message };

  const { error: dbError } = await supabase
    .from("users")
    .update({ avatar_url: path })
    .eq("id", auth.user.id);

  if (dbError) return { ok: false, message: dbError.message };

  revalidatePath("/you");
  revalidatePath("/you/settings");
  return { ok: true, message: "Avatar updated." };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(app\)/you/settings/actions.ts
git commit -m "feat(you): server actions for display name + avatar upload (WS4)"
```

---

## Task 6: `DisplayNameForm` + `AvatarUploader` client components

**Files:**
- Create: `apps/web/src/app/(app)/you/settings/display-name-form.tsx`
- Create: `apps/web/src/app/(app)/you/settings/avatar-uploader.tsx`

- [ ] **Step 1: Create `DisplayNameForm`**

```tsx
// apps/web/src/app/(app)/you/settings/display-name-form.tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/primitives";
import { type DisplayNameFormState, updateDisplayName } from "./actions";

const INITIAL: DisplayNameFormState = { ok: false, message: null };

export function DisplayNameForm({
  initialFirst,
  initialInitial,
}: {
  initialFirst: string;
  initialInitial: string;
}) {
  const [state, formAction, pending] = useActionState(updateDisplayName, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-widest text-foreground-subtle">
          First name
        </span>
        <input
          name="name_first"
          defaultValue={initialFirst}
          required
          maxLength={40}
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-widest text-foreground-subtle">
          Last initial
        </span>
        <input
          name="name_last_initial"
          defaultValue={initialInitial}
          maxLength={1}
          className="w-16 rounded-[8px] border border-border bg-surface px-3 py-2 text-base text-foreground uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save name"}
        </Button>
        {state.message ? (
          <span
            className={state.ok ? "text-sm text-moss-600" : "text-sm text-ember-500"}
          >
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create `AvatarUploader`**

```tsx
// apps/web/src/app/(app)/you/settings/avatar-uploader.tsx
"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/primitives";
import { type AvatarFormState, uploadAvatar } from "./actions";

const INITIAL: AvatarFormState = { ok: false, message: null };

export function AvatarUploader({
  currentSignedUrl,
  initial,
}: {
  currentSignedUrl: string | null;
  initial: string;
}) {
  const [state, formAction, pending] = useActionState(uploadAvatar, INITIAL);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentSignedUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex flex-col items-center gap-3">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-tint to-accent/30 border border-accent/40 flex items-center justify-center overflow-hidden">
        {previewUrl ? (
          // biome-ignore lint/performance/noImgElement: signed URL, no Next image loader needed here
          <img src={previewUrl} alt="Your avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="font-display text-4xl text-foreground">{initial}</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setPreviewUrl(URL.createObjectURL(file));
        }}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => inputRef.current?.click()}
        >
          Choose photo
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Save"}
        </Button>
      </div>
      {state.message ? (
        <span
          className={state.ok ? "text-sm text-moss-600" : "text-sm text-ember-500"}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/you/settings/display-name-form.tsx apps/web/src/app/\(app\)/you/settings/avatar-uploader.tsx
git commit -m "feat(you): DisplayNameForm + AvatarUploader client components (WS4)"
```

---

## Task 7: `/you/settings` unified page

**Files:**
- Create: `apps/web/src/app/(app)/you/settings/page.tsx`

**Why:** Consolidate identity, appearance, preferences, and account on one route. Admin block lives on the hub (Task 11), NOT here.

- [ ] **Step 1: Implement the page**

```tsx
// apps/web/src/app/(app)/you/settings/page.tsx
import { Button, Card, Divider } from "@/components/primitives";
import { PreferencesForm } from "@/app/(app)/settings/preferences-form";
import { MemberSinceEditor } from "@/app/(app)/settings/member-since-editor";
import { ThemeToggle } from "@/components/theme";
import { signOut } from "@/app/(app)/settings/actions";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { loadMemberPreferences } from "@/lib/preferences/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AvatarUploader } from "./avatar-uploader";
import { DisplayNameForm } from "./display-name-form";

export default async function YouSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("name_first, name_last_initial, role, joined_at, club_joined_at, avatar_url")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle();

  if (!profile || !auth.user) {
    // Layout middleware should already gate this, but fail safely if not.
    return null;
  }

  const displayName = formatMemberName(profile as MemberNameFields);
  const initial = profile.name_first?.charAt(0).toUpperCase() ?? "?";
  const preferences = await loadMemberPreferences(supabase, auth.user.id);

  const joinedSource: string | null = profile.club_joined_at ?? profile.joined_at ?? null;
  const joinedDate = joinedSource ? new Date(joinedSource) : null;
  const clubDate: Date | null = profile.club_joined_at
    ? new Date(profile.club_joined_at)
    : null;
  const currentMonth = clubDate ? clubDate.getUTCMonth() + 1 : null;
  const currentYear = clubDate ? clubDate.getUTCFullYear() : null;
  const joinedLabel = joinedDate
    ? `Member since ${joinedDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })}`
    : null;

  let avatarSignedUrl: string | null = null;
  if (profile.avatar_url) {
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_url, 60 * 60);
    avatarSignedUrl = signed?.signedUrl ?? null;
  }

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6 text-center">
        <h1 className="text-3xl">Settings</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle mt-1">
          {displayName}
        </p>
      </header>

      <Divider label="Account" />
      <Card className="mb-3">
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="large" className="w-full">
            Sign out
          </Button>
        </form>
      </Card>

      <Divider label="Identity" />
      <Card className="mb-3">
        <AvatarUploader currentSignedUrl={avatarSignedUrl} initial={initial} />
      </Card>
      <Card className="mb-3">
        <DisplayNameForm
          initialFirst={profile.name_first ?? ""}
          initialInitial={profile.name_last_initial ?? ""}
        />
      </Card>
      <Card className="mb-3">
        <MemberSinceEditor
          currentLabel={joinedLabel}
          currentMonth={currentMonth}
          currentYear={currentYear}
        />
      </Card>

      <Divider label="Appearance" />
      <ThemeToggle />

      {preferences ? (
        <>
          <Divider label="Taste preferences" />
          <Card className="mb-3">
            <PreferencesForm initial={preferences} />
          </Card>
        </>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: PASS.

- [ ] **Step 3: Smoke test**

Run: `pnpm --filter web dev`
Visit `/you/settings` (must be signed in). Verify:
- Sign-out button at top of Account
- Avatar uploader renders with letter fallback or current avatar
- Display-name form renders pre-filled
- Member-since editor renders
- Theme toggle renders
- Preferences form renders

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/you/settings/page.tsx
git commit -m "feat(you): unified /you/settings page (WS4)"
```

---

## Task 8: `/you/cellar` page

**Files:**
- Create: `apps/web/src/app/(app)/you/cellar/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
// apps/web/src/app/(app)/you/cellar/page.tsx
import { redirect } from "next/navigation";
import { CellarSection } from "@/components/members/sections";
import { Divider } from "@/components/primitives";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function YouCellarPage() {
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
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
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
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Smoke test**

Manual: visit `/you/cellar`. Cellar filter chips and product list render identically to `/members/[me]?tab=cellar`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/you/cellar/page.tsx
git commit -m "feat(you): /you/cellar full personal cellar view (WS4)"
```

---

## Task 9: `/you/tastings` page

**Files:**
- Create: `apps/web/src/app/(app)/you/tastings/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
// apps/web/src/app/(app)/you/tastings/page.tsx
import { redirect } from "next/navigation";
import { TastingsSection } from "@/components/members/sections";
import { Divider } from "@/components/primitives";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function YouTastingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name_first, name_last_initial")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) redirect("/login");

  const displayName = formatMemberName(profile as MemberNameFields);

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-5">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          {displayName}
        </p>
        <h1 className="text-3xl mt-1">Your tastings</h1>
      </header>

      <Divider label="The archive" />

      <TastingsSection memberId={auth.user.id} displayName={displayName} />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Smoke test**

Manual: visit `/you/tastings`. Renders identically to `/members/[me]?tab=tastings` (default tab).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/you/tastings/page.tsx
git commit -m "feat(you): /you/tastings full personal tastings view (WS4)"
```

---

## Task 10: `PersonalCard` primitive for the hub

**Files:**
- Create: `apps/web/src/app/(app)/you/_components/personal-card.tsx`

**Why:** Reusable card for the Cellar / Tastings entries on the hub. Shows title, count strip, up to 3 thumbnails, links to the full view.

- [ ] **Step 1: Implement the card**

```tsx
// apps/web/src/app/(app)/you/_components/personal-card.tsx
import Link from "next/link";
import { Card, Voice } from "@/components/primitives";

export type PersonalCardThumb = {
  productId: string;
  name: string;
  imageUrl: string | null;
};

export function PersonalCard({
  title,
  counts,
  thumbs,
  href,
  emptyVoice,
}: {
  title: string;
  counts: string | null;
  thumbs: PersonalCardThumb[];
  href: string;
  emptyVoice: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="hover:bg-surface-2 transition-colors">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-base text-foreground">{title}</p>
          {counts ? (
            <p className="text-[11px] uppercase tracking-widest text-foreground-subtle">
              {counts}
            </p>
          ) : null}
        </div>
        {thumbs.length > 0 ? (
          <div className="mt-3 flex items-center gap-2">
            {thumbs.slice(0, 3).map((t) =>
              t.imageUrl ? (
                // biome-ignore lint/performance/noImgElement: signed/public URL, no loader needed
                <img
                  key={t.productId}
                  src={t.imageUrl}
                  alt={t.name}
                  className="w-12 h-12 rounded-lg object-contain bg-surface-2"
                />
              ) : (
                <div
                  key={t.productId}
                  className="w-12 h-12 rounded-lg bg-surface-2 flex items-center justify-center text-[10px] uppercase tracking-widest text-foreground-subtle"
                >
                  ?
                </div>
              ),
            )}
          </div>
        ) : (
          <Voice className="block mt-3 text-sm">{emptyVoice}</Voice>
        )}
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(app\)/you/_components/personal-card.tsx
git commit -m "feat(you): PersonalCard primitive for hub cellar/tastings entries (WS4)"
```

---

## Task 11: `/you` hub page

**Files:**
- Create: `apps/web/src/app/(app)/you/page.tsx`

**Why:** The hub itself — hero with badges + next-badge, Winston one-liner, personal cards, club link, admin link (admins only), account links.

- [ ] **Step 1: Implement the hub**

```tsx
// apps/web/src/app/(app)/you/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { PersonalCard, type PersonalCardThumb } from "./_components/personal-card";
import { MemberBadges } from "@/components/members";
import { Card, Divider, Voice } from "@/components/primitives";
import { badgesForMember, loadMemberBadges } from "@/lib/badges/load";
import { computeMemberBadges, type BadgeComputeInput } from "@/lib/badges/compute";
import { MEMBER_BADGES } from "@/lib/badges/definitions";
import { nextBadgeForMember } from "@/lib/badges/next";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function YouHubPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const me = auth.user.id;

  // Parallel fetches. Re-use what badge loader already loads to avoid
  // a separate query when computing nextBadge.
  const [profileResult, badgeMap, cellarSnapshot, recentTastingsResult, badgeInputs] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, name_first, name_last_initial, role, joined_at, avatar_url")
        .eq("id", me)
        .maybeSingle(),
      loadMemberBadges(supabase),
      loadCellarSnapshot(supabase, me),
      supabase
        .from("tastings")
        .select(
          "id, product_id, product:products(id, name, image_url, type), created_at",
        )
        .eq("user_id", me)
        .order("created_at", { ascending: false })
        .limit(3),
      buildBadgeInputs(supabase),
    ]);

  if (!profileResult.data) redirect("/login");
  const profile = profileResult.data;
  const isAdmin = profile.role === "admin";
  const displayName = formatMemberName(profile as MemberNameFields);
  const initial = profile.name_first?.charAt(0).toUpperCase() ?? "?";

  let avatarSignedUrl: string | null = null;
  if (profile.avatar_url) {
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_url, 60 * 60);
    avatarSignedUrl = signed?.signedUrl ?? null;
  }

  const badges = badgesForMember(badgeMap, me);
  const nextBadge = nextBadgeForMember(badgeInputs, me);

  type TastingRow = {
    id: string;
    product_id: string;
    created_at: string;
    product: { id: string; name: string; image_url: string | null; type: string } | null;
  };
  const recentTastings = (recentTastingsResult.data as TastingRow[] | null) ?? [];
  const lastTasting = recentTastings[0] ?? null;
  const tastingThumbs: PersonalCardThumb[] = recentTastings
    .filter((t): t is TastingRow & { product: NonNullable<TastingRow["product"]> } => Boolean(t.product))
    .map((t) => ({
      productId: t.product.id,
      name: t.product.name,
      imageUrl: t.product.image_url,
    }));

  // Cellar thumbs: pick the 3 most-recent Have rows. The snapshot only carries
  // ids; resolve to {name,image_url} via a tiny query.
  const haveIds = Array.from(cellarSnapshot.have).slice(0, 3);
  let cellarThumbs: PersonalCardThumb[] = [];
  if (haveIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, image_url")
      .in("id", haveIds);
    cellarThumbs = ((products ?? []) as { id: string; name: string; image_url: string | null }[]).map(
      (p) => ({ productId: p.id, name: p.name, imageUrl: p.image_url }),
    );
  }

  const tastingsCount = await supabase
    .from("tastings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me)
    .then((r) => r.count ?? 0);

  const cellarCounts = `${cellarSnapshot.have.size} have · ${cellarSnapshot.want.size} want · ${cellarSnapshot.tried.size} tried`;
  const tastingsCountStr = `${tastingsCount} logged`;

  const lastVoice = lastTasting?.product
    ? lastTasting.product.type === "bourbon"
      ? `"You poured ${lastTasting.product.name} last."`
      : `"You lit ${lastTasting.product.name} last."`
    : null;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-tint to-accent/30 border border-accent/40 flex items-center justify-center overflow-hidden mb-4">
          {avatarSignedUrl ? (
            // biome-ignore lint/performance/noImgElement: signed URL
            <img src={avatarSignedUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-4xl text-foreground">{initial}</span>
          )}
        </div>
        <h1 className="text-3xl">{displayName}</h1>
        {profile.joined_at ? (
          <p className="text-sm text-foreground-muted mt-1">
            Member since{" "}
            {new Date(profile.joined_at).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
        ) : null}

        {badges.length > 0 || nextBadge ? (
          <div className="mt-5 flex items-start gap-4 justify-center flex-wrap">
            {badges.length > 0 ? <MemberBadges badges={badges} variant="hero" /> : null}
            {nextBadge ? (
              <span className="inline-flex flex-col items-center gap-1 w-16 opacity-50">
                <span className="inline-flex items-center justify-center rounded-full border border-dashed border-border bg-surface text-foreground-subtle font-medium tabular-nums min-w-[1.75rem] h-7 px-1.5 text-[11px] tracking-wide">
                  {nextBadge.badge.mark}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-foreground-subtle text-center leading-tight">
                  {nextBadge.badge.label}
                  <br />
                  {nextBadge.gap}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <Divider label="Personal" />

      {lastVoice ? <Voice className="block mb-4 text-sm">{lastVoice}</Voice> : null}

      <div className="flex flex-col gap-3">
        <PersonalCard
          title="Your cellar"
          counts={cellarCounts}
          thumbs={cellarThumbs}
          href="/you/cellar"
          emptyVoice='"The shelf is bare. Mark a few on hand."'
        />
        <PersonalCard
          title="Your tastings"
          counts={tastingsCountStr}
          thumbs={tastingThumbs}
          href="/you/tastings"
          emptyVoice='"Nothing logged yet, sir. Open the humidor."'
        />
        {/* Pairings card intentionally omitted; lands when WS3 ships. */}
      </div>

      <Divider label="The Club" />

      <Card className="mb-3">
        <Link
          href="/roadmap"
          className="block text-base text-foreground hover:text-foreground-muted"
        >
          Roadmap & Suggestions →
        </Link>
        <p className="text-sm text-foreground-subtle mt-1">
          See what's coming and send Paul a feature idea or bug report.
        </p>
      </Card>

      <Divider label="Account" />

      <Card className="mb-3">
        <Link
          href="/you/settings"
          className="block text-base text-foreground hover:text-foreground-muted"
        >
          Settings & preferences →
        </Link>
      </Card>

      {isAdmin ? (
        <Card className="mb-3">
          <Link
            href="/admin"
            className="block text-base text-foreground hover:text-foreground-muted"
          >
            Admin tools →
          </Link>
          <p className="text-sm text-foreground-subtle mt-1">
            Invites, suggestions, usage.
          </p>
        </Card>
      ) : null}
    </main>
  );
}

/**
 * Build the inputs `nextBadgeForMember` needs, in one round-trip set.
 * Mirrors loadMemberBadges but returns the raw inputs (not the earned map).
 * Done as a helper here to keep the page tidy; could move to lib/badges/load.ts later.
 */
async function buildBadgeInputs(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<BadgeComputeInput> {
  const [membersResult, tastingsResult, eventsResult, winstonResult] = await Promise.all([
    supabase.from("users").select("id, joined_at"),
    supabase
      .from("tastings")
      .select("user_id, product_id, recommend, created_at, event_id, product:products(type)"),
    supabase.from("events").select("id, date, host_user_id"),
    supabase
      .from("pairings_cache")
      .select("cigar_id, bourbon_id")
      .not("rationale_text", "is", null),
  ]);

  type TastingQueryRow = {
    user_id: string;
    product_id: string;
    recommend: boolean;
    created_at: string;
    event_id: string | null;
    product: { type: "cigar" | "bourbon" } | null;
  };

  const tastings = ((tastingsResult.data as TastingQueryRow[] | null) ?? []).flatMap((row) => {
    const type = row.product?.type;
    if (type !== "cigar" && type !== "bourbon") return [];
    return [
      {
        user_id: row.user_id,
        product_id: row.product_id,
        product_type: type,
        recommend: row.recommend,
        created_at: row.created_at,
        event_id: row.event_id,
      },
    ];
  });

  return {
    members: (membersResult.data ?? []) as BadgeComputeInput["members"],
    tastings,
    events: (eventsResult.data ?? []) as BadgeComputeInput["events"],
    winstonPairs: (winstonResult.data ?? []) as BadgeComputeInput["winstonPairs"],
  };
}
```

> **Note:** `buildBadgeInputs` duplicates the I/O inside `loadMemberBadges`. We accept the duplication for this task and leave a follow-up to refactor `lib/badges/load.ts` so both `loadMemberBadges` and `nextBadgeForMember` consume one canonical loader. Not in this plan; ship the hub first.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: PASS.

- [ ] **Step 3: Smoke test**

Manual:
- Visit `/you`. Verify hero (avatar / display name / member-since / badges + next-badge slot).
- Verify Winston one-liner if you have any tastings.
- Verify Cellar + Tastings cards render with thumbnails and counts.
- Click each card; lands on `/you/cellar` and `/you/tastings`.
- Verify "Admin tools →" appears only when signed in as Paul.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/you/page.tsx
git commit -m "feat(you): /you hub page (hero + personal + club + account) (WS4)"
```

---

## Task 12: Redirects — `/settings`, `/members/[me]`, `/shelf`

**Files:**
- Modify: `apps/web/src/app/(app)/settings/page.tsx`
- Modify: `apps/web/src/app/(app)/members/[id]/page.tsx`
- Modify: `apps/web/src/app/(app)/shelf/page.tsx`

- [ ] **Step 1: Redirect `/settings` → `/you/settings`**

Replace the entirety of `apps/web/src/app/(app)/settings/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function SettingsLegacyRedirect() {
  redirect("/you/settings");
}
```

> The form / editor components in `apps/web/src/app/(app)/settings/` (`actions.ts`, `member-since-editor.tsx`, `preferences-form.tsx`) are still consumed by `/you/settings`. Leave them in place. Only this page file changes.

- [ ] **Step 2: Redirect `/members/[me]` → `/you` (with tab mapping)**

Modify `apps/web/src/app/(app)/members/[id]/page.tsx`. Add at the top of the component body, before the existing `Promise.all`:

```tsx
const { id } = await params;
const { tab: tabRaw } = await searchParams;

const supabase = await createSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (user?.id === id) {
  if (tabRaw === "cellar") redirect("/you/cellar");
  if (tabRaw === "tastings") redirect("/you/tastings");
  redirect("/you");
}
```

Don't forget to add `import { redirect } from "next/navigation";` at the top. The existing `Promise.all` (with `supabase.auth.getUser()`) can keep its call — the early redirect short-circuits.

- [ ] **Step 3: Redirect `/shelf` → `/you/cellar`**

Replace `apps/web/src/app/(app)/shelf/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ShelfRedirect() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  redirect("/you/cellar");
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 5: Smoke test**

Manual:
- Visit `/settings` → bounces to `/you/settings`.
- Visit `/shelf` → bounces to `/you/cellar`.
- Visit `/members/<your-own-id>` → bounces to `/you`.
- Visit `/members/<your-own-id>?tab=cellar` → bounces to `/you/cellar`.
- Visit `/members/<other-id>` → still renders the member profile as before.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(app\)/settings/page.tsx apps/web/src/app/\(app\)/members/\[id\]/page.tsx apps/web/src/app/\(app\)/shelf/page.tsx
git commit -m "feat(you): redirect /settings, /shelf, /members/[me] into /you (WS4)"
```

---

## Task 13: Bottom-nav — point "You" at `/you`

**Files:**
- Modify: `apps/web/src/components/nav/bottom-nav.tsx`

- [ ] **Step 1: Update the You nav item**

Find the `SIDE_ITEMS` entry whose label is `"You"`. Replace it with:

```tsx
{
  href: "/you",
  label: "You",
  icon: User,
  match: (p) => p.startsWith("/you") || p.startsWith("/admin"),
},
```

Remove `/settings` and `/events` from the match pattern. The redirect from `/settings` handles legacy links; `/events` was never used (Meetups moved off the primary nav per the original UX-2 note in this file).

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: PASS.

- [ ] **Step 3: Smoke test**

Manual: with the dev server running, tap the You tab → lands on `/you`. Navigate to `/you/cellar` or `/you/settings`; You tab stays highlighted. Navigate to `/admin/*` (Paul only); You tab stays highlighted.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/nav/bottom-nav.tsx
git commit -m "feat(nav): You tab points at /you with /admin in match pattern (WS4)"
```

---

## Task 14: Final verification + clean-up commit

- [ ] **Step 1: Run the full test suite**

Run: `pnpm --filter web test`
Expected: All tests pass. No regressions from the sections extraction or the badges variant addition.

- [ ] **Step 2: Run typecheck + lint across the app**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: PASS, no new warnings.

- [ ] **Step 3: iPhone-viewport manual sweep**

In Chrome DevTools, set viewport to 375 × 667 (iPhone SE) and walk through:
1. `/you` — hero, badges, Winston voice, both cards, Account & Club sections all readable, no horizontal overflow.
2. `/you/settings` — every section renders, forms submit, sign-out works.
3. `/you/cellar` — filter chips work, product list scrolls.
4. `/you/tastings` — feed cards render.
5. `/members/<other>` — unchanged.
6. Bottom-nav stays anchored, no overlap with content.

Repeat at 430 × 932 (iPhone 14 Pro Max).

- [ ] **Step 4: Update `planning/nccc-roadmap.md`**

Append a row to the post-launch status section noting that WS4 (You hub redesign) shipped, with the date and a one-line summary. Match the file's existing formatting (search for the most-recent shipped item as a template).

- [ ] **Step 5: Commit the roadmap update**

```bash
git add planning/nccc-roadmap.md
git commit -m "docs(roadmap): note WS4 You hub redesign shipped"
```

---

## Self-review checklist (post-implementation, before merging)

- [ ] All 14 tasks committed; `git log --oneline` shows the WS4 trail.
- [ ] `/you`, `/you/settings`, `/you/cellar`, `/you/tastings` reachable and rendering.
- [ ] `/settings`, `/shelf`, `/members/[me]` redirect correctly (including `?tab=` mapping).
- [ ] Bottom-nav highlight works across `/you/*` and `/admin/*`.
- [ ] Avatar upload writes to `avatars` bucket and updates `users.avatar_url`; re-render shows the uploaded photo.
- [ ] Display-name edit persists and updates `formatMemberName` output everywhere (smoke-check on Feed / Members tab).
- [ ] Badges hero variant renders labels visibly; existing inline/profile variants unchanged.
- [ ] Next-badge slot appears when applicable; absent when nothing achievable.
- [ ] Admin link visible to Paul only.
- [ ] Pairings card NOT present (deferred per spec).
- [ ] No `console.error`s in the browser on `/you` load.

---

## Out of scope (do NOT implement here)

- Tap-popover tooltip for the existing `inline` / `profile` badge variants — separate follow-up ticket (see spec §Follow-up tickets).
- Stats card on `/you` — cut from v1; reintroduces with a comparator later.
- Pairings card on `/you` — appears when WS3 (Capture-a-Pairing) ships.
- Refactor `lib/badges/load.ts` to share I/O with `nextBadgeForMember` — duplication accepted; refactor later if performance becomes an issue.
- WS5+WS2 face refresh (Product Detail v3, catalog polish) — separate spec/plan.
- WS1 Lounge Find Your Next — separate spec/plan.
- WS3 Capture-a-Pairing — separate spec/plan.
