# First-Run Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a 3-step first-run onboarding sequence at `/welcome` that every new member completes once before entering the app, with DB-backed completion tracking and auth-path fixes.

**Architecture:** Add `users.onboarding_completed_at`. Split `(app)` into `(shell)` (BottomNav + gate) and `(onboarding)` (welcome only, no nav). Replace static welcome page with a client stepper (`WelcomeFlow`) driven by server-loaded profile. `completeOnboarding` server action sets the timestamp then redirects. App layout redirects incomplete members to `/welcome`.

**Tech Stack:** Next.js 16 (RSC + Server Actions + `"use client"` stepper), Supabase (Postgres + RLS), Tailwind v4, TypeScript strict, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-05-25-first-run-onboarding-design.md`. Read it before starting.

**Working principles:**
- iPhone-first (375 / 390 / 430 viewports).
- Brass = single primary action per step; ghost for secondary exits on step 3 only.
- Winston via `<Voice />` on steps 1 and 3; never on Capture.
- Identity: `formatMemberName` elsewhere; first name only in welcome voice lines.
- Commit after every passing test step.

**Lint/test commands** (from `apps/web/`):
- `pnpm test -- <path>` — vitest, single file
- `pnpm test` — full suite
- `pnpm lint` — biome
- `pnpm typecheck` — tsc --noEmit

---

## Task 1: Migration — `users.onboarding_completed_at`

**Files:**
- Create: `supabase/migrations/20260525000001_onboarding_completed.sql`

- [ ] **Step 1: Write the migration**

```sql
-- First-run onboarding gate (Tier 3 #17 expanded).
-- NULL = member has not finished /welcome. Backfill existing rows so launch members aren't gated.

alter table public.users
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.users.onboarding_completed_at is
  'Set when member finishes /welcome. NULL forces onboarding gate until complete.';

-- Existing members skip onboarding.
update public.users
set onboarding_completed_at = coalesce(onboarding_completed_at, joined_at)
where onboarding_completed_at is null;
```

- [ ] **Step 2: Apply migration**

Run: `supabase db push`
Expected: column exists; all current users have non-null `onboarding_completed_at`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260525000001_onboarding_completed.sql
git commit -m "feat(db): add onboarding_completed_at to users"
```

---

## Task 2: Onboarding lib + server action

**Files:**
- Create: `apps/web/src/lib/onboarding/types.ts`
- Create: `apps/web/src/lib/onboarding/load.ts`
- Create: `apps/web/src/lib/onboarding/complete.ts`
- Create: `apps/web/src/lib/onboarding/load.test.ts`
- Test: `apps/web/src/lib/onboarding/load.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/onboarding/load.test.ts
import { describe, expect, it } from "vitest";
import { needsOnboarding } from "./load";

describe("needsOnboarding", () => {
  it("returns true when onboarding_completed_at is null", () => {
    expect(needsOnboarding({ onboarding_completed_at: null })).toBe(true);
  });

  it("returns false when onboarding_completed_at is set", () => {
    expect(needsOnboarding({ onboarding_completed_at: "2026-05-25T00:00:00Z" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- src/lib/onboarding/load.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement types + load helper**

```typescript
// apps/web/src/lib/onboarding/types.ts
export type OnboardingProfile = {
  name_first: string;
  onboarding_completed_at: string | null;
};

export type OnboardingExit = "capture" | "preferences" | "lounge";
```

```typescript
// apps/web/src/lib/onboarding/load.ts
import type { OnboardingProfile } from "./types";

export function needsOnboarding(profile: Pick<OnboardingProfile, "onboarding_completed_at">): boolean {
  return profile.onboarding_completed_at == null;
}
```

- [ ] **Step 4: Implement complete action**

```typescript
// apps/web/src/lib/onboarding/complete.ts
"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OnboardingExit } from "./types";

const EXIT_PATH: Record<OnboardingExit, string> = {
  capture: "/capture",
  preferences: "/you/settings#preferences",
  lounge: "/",
};

export async function completeOnboarding(exit: OnboardingExit): Promise<never> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  await supabase
    .from("users")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", auth.user.id)
    .is("onboarding_completed_at", null);

  redirect(EXIT_PATH[exit]);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- src/lib/onboarding/load.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/onboarding/
git commit -m "feat(onboarding): add completion helper and server action"
```

---

## Task 3: Route-group split — shell vs onboarding

**Files:**
- Create: `apps/web/src/app/(app)/(shell)/layout.tsx`
- Move: all `(app)/*` routes except `welcome/` → `(app)/(shell)/`
- Modify: `apps/web/src/app/(app)/layout.tsx`
- Modify: `apps/web/src/app/(app)/welcome/page.tsx`

**Move list** (everything currently under `(app)/` except `welcome/` and `layout.tsx`):
- `page.tsx`, `capture/`, `products/`, `pairings/`, `members/`, `events/`, `you/`, `settings/` (if any orphan), `admin/`, `roadmap/`, etc.

- [ ] **Step 1: Slim root `(app)/layout.tsx` to auth-only**

```tsx
// apps/web/src/app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, name_first, name_last_initial")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) redirect("/login");

  return <>{children}</>;
}
```

- [ ] **Step 2: Create `(shell)/layout.tsx` with gate + BottomNav**

```tsx
// apps/web/src/app/(app)/(shell)/layout.tsx
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/nav/bottom-nav";
import { needsOnboarding } from "@/lib/onboarding/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("onboarding_completed_at")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle();

  if (profile && needsOnboarding(profile)) {
    redirect("/welcome");
  }

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
```

- [ ] **Step 3: Move routes into `(shell)/`**

Use `git mv` for each top-level route folder/file under `(app)/` into `(app)/(shell)/`. Leave `welcome/` at `(app)/welcome/`.

- [ ] **Step 4: Verify routes unchanged**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS (update any broken relative imports if they existed — unlikely with `@/` alias).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(app)/
git commit -m "refactor(app): split shell layout for onboarding gate"
```

---

## Task 4: Welcome flow UI (3-step client component)

**Files:**
- Create: `apps/web/src/components/onboarding/welcome-flow.tsx`
- Modify: `apps/web/src/app/(app)/welcome/page.tsx`
- Modify: `apps/web/src/app/(app)/you/settings/page.tsx` (add `id="preferences"` anchor)

- [ ] **Step 1: Build `WelcomeFlow` client component**

```tsx
// apps/web/src/components/onboarding/welcome-flow.tsx
"use client";

import { BookOpen, Plus, Sparkles, User, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { Winston } from "@/components/brand";
import { Divider, Voice } from "@/components/primitives";
import { completeOnboarding } from "@/lib/onboarding/complete";
import type { OnboardingExit } from "@/lib/onboarding/types";
import { cn } from "@/lib/utils";

type Props = { firstName: string };

export function WelcomeFlow({ firstName }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, startTransition] = useTransition();

  function finish(exit: OnboardingExit) {
    startTransition(() => {
      void completeOnboarding(exit);
    });
  }

  return (
    <div className={cn("transition-opacity duration-400", pending && "opacity-60 pointer-events-none")}>
      <p className="text-center text-meta text-foreground-subtle mb-6">{step} of 3</p>

      {step === 1 && (
        <>
          <figure className="mb-6 flex flex-col items-center">
            <Winston variant="library" size={1024} className="w-full max-w-sm h-auto rounded-[16px] border border-border" decorative={false} />
          </figure>
          <header className="text-center mb-4">
            <p className="text-sm tracking-widest uppercase text-foreground-subtle">A warm welcome</p>
            <h1 className="text-4xl mt-1">Meet Winston</h1>
          </header>
          <Voice className="text-center mb-8">
            &ldquo;A pleasure to have you, {firstName}. The shelves are stocked and the leather&apos;s warm. Step in.&rdquo;
          </Voice>
          <button type="button" onClick={() => setStep(2)} className="primary-button-classes w-full h-14">
            Continue
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <figure className="mb-6 flex justify-center">
            <Winston variant="bust" size={256} className="w-28 h-auto" decorative={false} />
          </figure>
          <Divider label="How NCCC works" />
          {/* three li blocks per spec — copy from design spec */}
          <button type="button" onClick={() => setStep(3)} className="primary-button-classes w-full h-14 mt-8">
            Continue
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <Divider label="Your map" />
          {/* five map rows with Lucide icons per spec */}
          <Voice className="text-center my-6">
            &ldquo;The night is yours, {firstName}. Where shall we begin?&rdquo;
          </Voice>
          <button type="button" onClick={() => finish("capture")} className="primary-button-classes w-full h-14 mb-3">
            Capture something
          </button>
          <button type="button" onClick={() => finish("preferences")} className="secondary-button-classes w-full h-12 mb-3">
            Set my preferences
          </button>
          <button type="button" onClick={() => finish("lounge")} className="ghost-link w-full">
            Explore the lounge
          </button>
        </>
      )}
    </div>
  );
}
```

Replace `primary-button-classes` / `secondary-button-classes` with the existing `Button` primitive (`variant="primary" | "secondary" | "ghost"`) — use `@/components/primitives` `Button`, not raw class strings.

- [ ] **Step 2: Update welcome page (RSC shell)**

```tsx
// apps/web/src/app/(app)/welcome/page.tsx
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";
import { needsOnboarding } from "@/lib/onboarding/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function WelcomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("name_first, onboarding_completed_at")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle();

  if (profile && !needsOnboarding(profile)) {
    redirect("/");
  }

  const firstName = profile?.name_first ?? "friend";

  return (
    <AppShell auth spacious className="pb-10">
      <WelcomeFlow firstName={firstName} />
    </AppShell>
  );
}
```

Note: `AppShell auth` removes bottom-nav clearance; welcome has no BottomNav because it lives outside `(shell)`.

- [ ] **Step 3: Add `#preferences` anchor on settings**

In `apps/web/src/app/(app)/(shell)/you/settings/page.tsx`, wrap the Preferences section:

```tsx
<section id="preferences">
  <Divider label="Preferences" />
  ...
</section>
```

- [ ] **Step 4: Manual smoke on 375px viewport**

1. Reset test user: `update users set onboarding_completed_at = null where id = '<uuid>';`
2. Visit `/` → redirects to `/welcome`.
3. Step through 1→2→3; tap **Explore the lounge** → lands on `/`, no redirect loop.
4. Revisit `/welcome` → redirects to `/`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/onboarding/ apps/web/src/app/(app)/welcome/ apps/web/src/app/(app)/(shell)/you/settings/
git commit -m "feat(onboarding): 3-step welcome flow with exit paths"
```

---

## Task 5: Auth path fixes

**Files:**
- Modify: `apps/web/src/app/(auth)/accept-invite/actions.ts:89`

- [ ] **Step 1: Fix Case A redirect**

Change line 89 from `redirect("/")` to `redirect("/welcome")`.

- [ ] **Step 2: Verify callback still routes Case B to welcome**

Read `apps/web/src/app/auth/callback/route.ts` — confirm `justJoined ? "/welcome"` unchanged.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(auth)/accept-invite/actions.ts
git commit -m "fix(auth): route immediate signup to welcome onboarding"
```

---

## Task 6: Roadmap + design system updates

**Files:**
- Modify: `planning/nccc-roadmap.md` (item #17 status + scope)
- Modify: `docs/design-system.md` §11 (onboarding visual treatment → locked)

- [ ] **Step 1: Update roadmap #17**

Change status from `🟡 in flight` to reflect 3-step sequence + link to spec/plan. Note auth fix.

- [ ] **Step 2: Update design system open item**

Replace "Onboarding visual treatment — TBD" with pointer to spec: leather-bound book, 3 steps, no nav, no overlays.

- [ ] **Step 3: Commit**

```bash
git add planning/nccc-roadmap.md docs/design-system.md docs/superpowers/
git commit -m "docs: lock first-run onboarding spec and roadmap status"
```

---

## Task 7: Verification

- [ ] **Step 1: Run full test suite**

Run: `cd apps/web && pnpm test && pnpm lint && pnpm typecheck`
Expected: all pass.

- [ ] **Step 2: Pre-launch checklist flow**

1. Admin generates invite in `/admin`.
2. Open invite link in incognito → accept-invite form → submit.
3. Confirm landing on `/welcome` step 1 (both email-confirm ON and OFF if testable).
4. Complete onboarding → Capture path → `/capture` loads with bottom nav, no Winston on capture page.
5. First Recommend → product detail → cellar prompt if applicable.

- [ ] **Step 3: Confirm existing members unaffected**

Paul's account: `onboarding_completed_at` non-null after migration; `/welcome` redirects to `/`.

---

## Self-review (spec coverage)

| Spec requirement | Task |
|---|---|
| 3-step sequence | Task 4 |
| DB completion flag | Task 1 |
| Gate incomplete users | Task 3 |
| No bottom nav on welcome | Task 3 route split |
| Auth Case A fix | Task 5 |
| Backfill existing members | Task 1 migration |
| Step 3 exit paths | Task 4 + Task 2 action |
| `#preferences` deep link | Task 4 |
| Winston placement rules | Task 4 (steps 1+3 only) |
| No overlay tours | N/A — not built |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-25-first-run-onboarding.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?
