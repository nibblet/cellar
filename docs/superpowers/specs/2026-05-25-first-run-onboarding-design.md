# First-Run Onboarding — Design Spec

**Status:** Approved 2026-05-25. Pre-launch blocker (roadmap pre-launch checklist #7).

**Roadmap item:** Tier 3 #17 (expanded from single static screen to a 3-step sequence).

---

## Problem

Tier 1 and most of Tier 2 are shipped. The app now has Daily Pour, Find Your Next, Cellar, Capture-a-Pairing, You hub, Preferences, and a 4-tab + FAB nav — far more surface area than when #17 was scoped as one static page.

Today:
- `/welcome` exists with Winston + three orienting bullets + brass CTA.
- Auth callback routes new members to `/welcome` only on the email-confirmation path (Case B).
- Immediate signup (Case A, no email confirm) redirects to `/` and **skips welcome entirely**.
- No DB flag — members can revisit `/welcome` but nothing forces completion; nothing prevents skipping.

New members need a short, ceremonial walkthrough that reflects the **current** app without overlay tours or a preferences form on step one.

---

## Goals

1. Every new member sees the same onboarding sequence exactly once before using the app.
2. Winston introduces the club; the sequence explains **what to do first**, not every feature.
3. Honor design system: brass = one primary per screen, Winston voice via `<Voice />`, no sliders, no overlay highlights on live UI.
4. Existing members (Paul + anyone already on `main`) are backfilled and never gated.

---

## Non-goals

- Spotlight / coach-mark tours on Feed, Capture, or product detail.
- Collecting preferences inside onboarding (Settings already has `PreferencesForm`).
- Forcing a first capture before entering the app (soft nudge, not a hard gate).
- Education library content (Tier 3 #14).

---

## Flow

```
Accept invite → Auth callback → /welcome (3 steps) → member picks exit CTA → app
```

### Step 1 — Meet Winston

- Illustration: `winston-library.png` (`<Winston variant="library" />`).
- Eyebrow: `A warm welcome`
- Title: `Meet Winston`
- Voice line (personalized first name): *"A pleasure to have you, {firstName}. The shelves are stocked and the leather's warm. Step in."*
- Progress: `1 of 3` (tracked-widest meta, not interactive dots).
- Primary: **Continue** (advances step; brass).

### Step 2 — How the club works

- Illustration: `winston-bust.png` (smaller, centered).
- Divider: `<Divider label="How NCCC works" />`
- Three blocks (updated for shipped features):

| Label | Copy |
|---|---|
| **Snap and recommend** | Photograph a cigar band or bourbon label. One tap on *Recommend to NCCC* adds your voice to the archive — optional flavor chips, no scores. |
| **The club speaks** | Every product shows what members actually taste. Winston pairs cigars and bourbons; moss marks what the club has validated together. |
| **Your shelf, your taste** | Track Have / Want / Tried in your Cellar. Set preferences in Settings when you're ready — until then, Winston stays neutral. |

- Primary: **Continue** (brass).

### Step 3 — Know your way around

- Divider: `<Divider label="Your map" />`
- Five static rows (Lucide icons, no live nav highlighting):

| Icon | Label | One line |
|---|---|---|
| BookOpen | Lounge | Daily Pour, club tastings, and catalog shelves. |
| Plus (in circle outline) | Capture | The center button — snap and recommend. |
| Users | Members | Roster and everyone's Cellar. |
| Sparkles | Pairings | Winston's matches; capture a pairing from here. |
| User | You | Settings, preferences, your Cellar and tastings. |

- Voice: *"The night is yours, {firstName}. Where shall we begin?"*
- **Primary (brass):** **Capture something** → `/capture` (completes onboarding).
- **Secondary (ghost):** **Set my preferences** → `/you/settings` (scroll target `#preferences`; completes onboarding).
- **Ghost link:** **Explore the lounge** → `/` (completes onboarding).

Completing onboarding = setting `users.onboarding_completed_at = now()` via server action before navigation.

---

## Visual treatment

- **Leather-bound book:** onboarding runs full-screen without bottom nav (dedicated route-group layout).
- Background: default app canvas (dot grid + lamplight — already on `body`).
- Step transitions: 400ms fade + 2px upward drift (design system §8 reveals).
- No swipe-between-steps — explicit Continue taps only (one primary action per step).

---

## Routing & gating

| Route | Nav visible | Gated |
|---|---|---|
| `/welcome` | No | Exempt (always reachable while incomplete) |
| All other `(app)` routes | Yes | Redirect to `/welcome` if `onboarding_completed_at IS NULL` |

Auth paths (`/login`, `/accept-invite`, `/auth/callback`) unchanged.

**Backfill migration:** `UPDATE users SET onboarding_completed_at = joined_at WHERE onboarding_completed_at IS NULL;`

---

## Auth fixes (same ship)

1. **Case A signup** (`accept-invite/actions.ts` line 89): change `redirect("/")` → `redirect("/welcome")`.
2. **Callback** keeps `justJoined ? "/welcome"` for Case B — no change needed.

---

## Success criteria

- [ ] Fresh invite signup (both Case A and Case B) lands on `/welcome` step 1.
- [ ] Incomplete member hitting `/`, `/capture`, `/you`, etc. redirects to `/welcome`.
- [ ] Any step-3 exit marks complete; subsequent visits never redirect.
- [ ] Existing members backfilled; Paul never sees onboarding unless reset.
- [ ] Winston appears on steps 1 and 3 only; step 2 uses bust illustration without extra voice paragraph beyond section copy.
- [ ] Capture screen remains Winston-free after onboarding.

---

## Open questions (resolved)

| Question | Decision |
|---|---|
| Hard-gate first capture? | No — brass nudge to Capture, ghost exits allowed. |
| Preferences in onboarding? | No — link to Settings only. |
| Re-show onboarding? | Admin SQL reset of `onboarding_completed_at` for testing; no in-app replay v1. |
