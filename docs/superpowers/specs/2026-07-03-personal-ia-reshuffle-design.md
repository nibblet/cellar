# Personal IA Reshuffle

**Status:** Approved in chat 2026-07-03. Pending written-spec review.
**Author:** Paul + GPT (brainstorming session, 2026-07-03).

---

## Why this exists

The solo fork has outgrown its current route split.

Today, the personal experience is spread across multiple places:
- `/` behaves like a cellar dashboard.
- `/you/cellar` repeats almost the same stack.
- `/pairings` carries some of the real "what should I do tonight?" logic.
- `/you` is part profile hub, part archive launcher, but not yet the true front door.

That creates a structural mismatch:
- **Cellar** should feel like collection management.
- **You** should feel like personal concierge guidance.
- **Settings** should feel like preferences and identity, not like a mislabeled personal home.

The approved direction is to separate those jobs cleanly and make the app feel centered on the individual member rather than on a mixed lounge/dashboard concept.

---

## Core decision

### `You` becomes the front door

When the member opens the app, the first destination should be **You**.

Conceptually:
- `You` = *What should I pour, smoke, or look at right now?*
- `Cellar` = *What do I own, want, or have tried?*
- `Settings` = *Who am I in this app, and how should it personalize for me?*

### `Cellar` stands alone

Cellar is no longer the main page and no longer hosts the concierge stack.

It becomes a dedicated collection space:
- Have / Want / Tried
- ranking and reordering within the collection
- search, filtering, and inventory browsing
- shelf-aware utility, but not Winston-led guidance

### `Pairings` is demoted from primary navigation

Pairings remains useful, but it is no longer a top-level destination competing with `You`.

It becomes one of two things:
- a **detail flow** reached from `Tonight's pick`, `Try next`, and product pages
- a **personal archive** reached from `You`

It should stop acting like a parallel home page.

---

## Recommended routing model

| Route | Role |
|---|---|
| `/` | Redirects to `/you`. The app's front door is personal, not cellar-first. |
| `/you` | Personal concierge home. |
| `/cellar` | Standalone collection page. |
| `/settings` | Identity, preferences, theme, account. |
| `/catalog` | Browse the broader library. |
| `/capture` | Primary action, unchanged. |
| `/pairings/[cigarId]/[bourbonId]` | Pairing detail, unchanged as a detail route. |
| `/you/tastings` | Personal tasting archive. |
| `/you/pairings` | Personal pairing archive or log, if retained. |

Redirects:
- `/you/cellar` → `/cellar`
- `/shelf` → `/cellar`
- legacy settings entry points remain valid but resolve to `/settings`

This keeps `You`, `Cellar`, and `Settings` as distinct mental models instead of child pages of the same bucket.

---

## Navigation model

The primary shell should reflect the new personal hierarchy:

- `You`
- `Cellar`
- `Catalog`
- `Capture`

`Capture` remains the shell's brass primary action.

`Settings` does **not** need to be a primary tab to be a first-class page. It should be reached from `You` through a clear account/settings entry. That keeps the everyday navigation focused on **guide / collect / browse / log**.

If the current five-slot bottom-nav layout proves too rigid, it should be redesigned rather than keeping a top-level `Pairings` tab purely to fill space.

---

## Page jobs

## `/you` — personal concierge home

This page should answer: **What feels right for me tonight?**

Recommended sections, in order:

1. **You poured last**
   - A single personal recall line at the top.
   - This becomes the "you were here last" anchor.

2. **Tonight's pick**
   - The most immediate suggestion surface.
   - Should feel like a useful nudge, not a separate destination.

3. **Winston suggests**
   - Winston belongs here because this is a recommendation surface.
   - He should appear in the recommendation modules, not as decorative profile chrome.

4. **Try next**
   - Discovery driven by personal taste and cellar state.

5. **Personal shortcuts**
   - Your tastings
   - Your pairings
   - Settings

6. **Optional secondary stats**
   - Badges or a collapsed "for the geek" strip can live here, but only as secondary context.
   - This page should not drift into a dashboard of trivia.

The page should feel like a calm personal steward: recent memory, tonight's direction, next recommendation.

---

## `/cellar` — collection utility

This page should answer: **What do I have, what do I want, and what have I tried?**

Keep here:
- Have / Want / Tried segmentation
- sorting and filtering
- wishlist ranking
- on-shelf indicators
- inventory browsing

Move out:
- `Tonight's pick`
- `Winston suggests`
- `Try next`
- personal recap copy that belongs to `You`

Cellar should feel quieter and more utilitarian than `You`.

Winston should only appear here in empty states or very small system moments, not as a persistent host voice.

---

## `/settings` — identity and personalization

This page should answer: **How should the app know me and tailor itself to me?**

Owns:
- avatar and display name
- theme
- taste preferences
- account actions
- low-frequency admin/account utilities

This page is not a hub and not a recommendation surface.

It should be intentionally plain and dependable.

---

## `Pairings` after the reshuffle

The current top-level Pairings page is doing too much structural work.

After the reshuffle:
- pairing **detail** remains important
- pairing **history/archive** remains useful
- pairing **discovery** should mostly begin from `You`

Recommended change:
- remove `Pairings` from bottom-nav
- keep pairing detail routes intact
- keep a personal pairings archive reachable from `You`
- if the `/pairings` index survives, reframe it as a secondary archive/log surface rather than a parallel recommendation homepage

In other words: **pairings become a follow-on experience, not a pillar of the shell.**

---

## Element reshuffle

### Move to `You`
- `You poured last`
- `Tonight's pick`
- `Winston suggests`
- `Try next`
- quick links into personal tasting/pairing history

### Keep in `Cellar`
- Have / Want / Tried collection states
- wishlist order
- owned-vs-not-owned organization
- browse / sort / filter mechanics

### Keep in `Settings`
- preferences
- profile identity
- account controls

This is the heart of the redesign: **guidance lives in `You`; inventory lives in `Cellar`; control lives in `Settings`.**

---

## Naming cleanup

The current app mixes `Cellar`, `humidor`, and `shelf` in ways that blur page identity.

Recommended language cleanup:
- **You** = personal concierge page
- **Cellar** = collection page
- **Catalog** = broader browse page
- within Cellar, use **Have / Want / Tried** consistently

Use `humidor` or `shelf` as supporting copy only when it adds flavor, not as competing route identity.

The route and nav labels should stay plain and stable.

---

## Design-system constraints to preserve

- The shell-level brass action remains `Capture`.
- `You` should not turn into a bright dashboard; recommendation modules can carry the stronger emphasis.
- Winston appears only where the design system allows him: recommendation surfaces, empty states, and small system messages.
- Etched dividers remain the way major sections are separated.
- No ratings, no sliders, no public-social framing.

This is a **reorganization**, not a tonal reset.

---

## What this intentionally does not decide

- Exact bottom-nav visual geometry after removing the Pairings tab.
- Whether `/pairings` index remains as a real page or collapses fully into `/you/pairings`.
- Whether personal badges/stats sit on `You` by default or behind a lighter secondary affordance.

Those are implementation-planning questions. The information architecture direction is already decided:

**`You` is home. `Cellar` is standalone. `Settings` owns personalization. `Pairings` is secondary.**

---

## Risks

- The current codebase has duplicated concierge content between `/` and `/you/cellar`; the implementation should avoid simply moving the duplication.
- If `Settings` becomes too prominent in primary nav, the shell may feel utility-heavy instead of personal.
- If too much of Cellar's ranking logic moves to `You`, Cellar may stop feeling useful as a management surface.

The safe line is clear:
- recommendations and narrative in `You`
- collection mechanics in `Cellar`
- controls in `Settings`

