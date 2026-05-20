# NCCC — Norton Commons Cigar Club App Spec

A private iPhone-first PWA for the Norton Commons Cigar Club: 12 guys, monthly bourbon and cigar tastings. The app exists to move good cigars and bourbons between members through shared discovery — not to be a public tasting journal, not to be Distiller, not to compete with Untappd.

---

## 1. Concept (one sentence)

A private, beautifully-designed iPhone app where 12 NCCC guys snap photos of what they're smoking and pouring, recommend it to each other in a single tap, and discover what to try next based on theoretical pairings and the group's collective voice.

---

## 2. Users and access

- **12 members, total.** No public signup, no growth strategy.
- **Invite-only.** A member (or admin) generates a single-use invite link / code.
- **One admin to start** (the builder). Add light "trusted member" admin later if needed.
- **Identity format everywhere:** first name + last initial (e.g., "Paul C"). Handles the two Pauls in the club. Implemented as a single global formatter so it can't drift.

---

## 3. The core loop

1. Member opens the app (in the chair, smoking, one-handed, half-buzzed).
2. Taps the shutter on the **Capture** screen.
3. Photo of cigar band or bourbon label is sent for identification.
4. **Reveal**: the product card materializes with its name, basic specs, and the group's voice on it ("8 NCCC members have smoked this. 6 recommend.").
5. Member taps **"Recommend to NCCC"** (the primary action — binary, one tap).
6. Optionally adds 1–3 flavor chips (autocompletes from the wheel but accepts any text) and an optional one-sentence note.
7. Saves. Back to the conversation.

In the background:
- LLM maps the chips + note onto the fixed flavor wheel as a sparse 0–5 score vector.
- The tasting is added to the group feed and the product's aggregated voice.
- The pairing engine can now use this tasting in its recommendations.

---

## 4. Three killer screens

### 4.1 Capture
- Opens to camera viewfinder (~60% screen) with subtle band-alignment guides.
- Segmented toggle: **Cigar / Bourbon**.
- One large shutter button. Library-pick and search-by-name as quiet fallback links.
- Tap shutter → photo → 2-second ID call → **Reveal screen**:
  - Hero photo (sepia-overlaid via CSS, not baked).
  - Product title (Playfair Display), category line, key specs.
  - The group-voice headline: "N NCCC members have had this. M recommend."
  - Primary CTA in brass: **"Recommend to NCCC."**
  - Tiny "Not quite right? Edit" link to handle misidentification.

### 4.2 Product Detail (Group Voice — the destination screen)
- Sepia hero image (best member-contributed shot wins).
- Title block.
- **THE CLUB SAYS** section divider (etched style).
  - Visceral recommend bar: row of cigar icons (lit/dim) or glencairn icons (full/empty) — N of M.
  - Member takes: one line each, prefixed by a colored dot (ember = recommend, ink = passed). Format "Paul C  '<their note>'". Collapsed after ~3, expandable.
- **HOW IT TASTES** section.
  - Frequency tag cloud of the most-mentioned wheel leaves across all NCCC tastings of this product. Size by frequency.
- **PAIRS WITH** section.
  - Two or three pairing cards, prioritized: group-validated first, then theoretical.
  - Each card states "why" in plain English ("the cigar leans cocoa and leather; a wheated bourbon's vanilla rounds the finish").
- **THE FACTS** section, collapsed by default. Wrapper/binder/filler/factory or mash bill/proof/age.

### 4.3 Pairing Suggestion
- Opens with The Bartender's italic-serif intro: *"The Bartender suggests…"*
- Hero of the suggested product.
- **WHY THIS PAIRING** prose paragraph, derived from the pairing_traits math but written in plain English.
- **CLUB STATUS** marker:
  - Moss color: "Carl B paired this in March and recommended it."
  - Or: "The club hasn't tested this combination yet — try it and tell us how it went."
- CTAs: "+ Add to tonight" (one-tap log) and "Show me 2 more pairings."

---

## 5. The flavor wheel (silent infrastructure)

Already drafted and committed:
- `data/flavor-wheels/wheel-schema.md` — structure, conventions, shared `pairing_traits` vocab.
- `data/flavor-wheels/cigar-wheel-v1.json` — 35 leaves, 8 categories.
- `data/flavor-wheels/bourbon-wheel-v1.json` — 39 leaves, 6 categories.
- Shared 10-trait vocabulary (sweet, creamy, warm, sharp, woody, earthy, roasted, bright, dry, fruity) is the bridge between the two wheels for pairing math.

**Critical rule:** sliders never appear in the user-facing UI. The wheel is invisible. Users type chips and notes; the LLM does the mapping. The wheel only surfaces as the **aggregated tag cloud** on the product page ("most mentioned by NCCC").

Cigar wheel accuracy is the bigger risk than bourbon (the user explicitly noted "we don't talk in floral terms about cigars" and "cigars is much harder"). Weight LLM mapper prompt tuning and synonym expansion toward the cigar wheel during the 30-day post-launch evolution cycle.

---

## 6. Identification & catalog

### 6.1 Identification flow
- Photo arrives in the API.
- **Stage 1: CLIP image embedding.** Compute the embedding, compare against the `product_images` table (pgvector). If a high-confidence match exists in our catalog, return that product directly.
- **Stage 2: OpenAI Vision call.** If no embedding match, ask GPT-4 Vision to extract: brand, line, vitola (or bottle name + proof + age), wrapper/mash-bill guess. Structured output schema.
- **Stage 3: Catalog match-or-create.** Fuzzy-match the extracted name against `products`. If found, link the new photo's embedding to that product (improves future matching). If not found, create the product as `draft` status — the member sees the AI's best guess and can confirm or correct before save.
- **Stage 4: Backfill.** For a newly-created product, asynchronously enrich from external sources (Halfwheel review search, Wikipedia, cigar-api.com for specs).

### 6.2 Catalog seeding
- **Bourbon (~500):** Ingest [bourbonExplorer GitHub dataset](https://github.com/Cred1747/bourbonExplorer) + [makispl whiskey CSV](https://github.com/makispl/Machine-Learning-Whiskey-Dataset). One-shot Node script populates `products`.
- **Cigar (~500):** Ingest Halfwheel RSS feed (last 3 years) + cigar-api.com (mainstream SKUs). One-shot Node script.
- **AVOID:** Cigar Aficionado scrape (aggressive ToS), Whiskybase scrape, Distiller scrape. Distiller's *taxonomy* (84-tag list) is uncopyrightable and already reflected in the bourbon wheel.
- **Long tail:** Filled in by AI on first scan + member correction.

### 6.3 Catalog descriptor enrichment
- For seeded products with attached review text, run a one-time LLM pass that extracts a wheel vector per product ("based on this review, what wheel leaves apply at what intensity?"). Stored on the product record.
- This gives every catalog entry a "published flavor profile" that's used for pairing math from day one — so pairings aren't empty before members rate things.

---

## 7. Pairing engine (v1, rules-based)

No ML. Pure rules over the 10 shared pairing traits.

### 7.1 The math
- Every product (cigar or bourbon) has a `wheel_vector` (the LLM-extracted intensities for each wheel leaf, 0–5).
- Each leaf has 1–2 `pairing_traits`. Roll up the vector to a `trait_vector` per product: for each trait, sum the intensities of all leaves carrying that trait, normalize to 0–1.
- For pairing, compare the cigar's trait_vector against candidate bourbons' trait_vectors using a set of rules:
  - **Balance rules** (e.g., high `earthy` + `dry` cigar pairs with high `sweet` + `creamy` bourbon).
  - **Harmony rules** (e.g., `roasted` cigar pairs with `roasted` bourbon).
  - **Conflict rules** (e.g., very `sharp` cigar + very `sharp` bourbon = penalty).
- Output a score per candidate. Return top 3.

### 7.2 Group-validation overlay
- If a pairing has been logged together at a meetup (both cigar and bourbon tasted by the same person in the same event), promote it to "club-validated" status.
- Group-validated pairings always rank above theoretical, regardless of score.

### 7.3 "Why" copy generation
- For each top-3 pairing, generate a one-paragraph explanation using the trait math as input to a small LLM call (cached per cigar+bourbon pair).
- Voice: The Bartender's gentlemanly italic register.

### 7.4 Honest caveat
- Pairing quality will feel weak for ~2–3 months until enough tasting data accumulates. The rules-based engine works on theoretical math from day one, but "the club has paired this" data is the more trusted source and takes time to build.

---

## 8. Identity, design, and tone

Already locked at [docs/design-system.md](../docs/design-system.md) v0.2.

- **Logo:** unicorn in a smoking jacket and glasses, smoking a cigar, holding a Glencairn glass in an ashtray.
- **Mascot/voice:** "The Bartender." Speaks in Playfair Display italic. Appears in empty states, recommendation headers, system messages. Never on capture/feed/product-detail screens.
- **Palette:** ink + paper + brass primary; ember (lit recommend icons only) and moss (club-validated pairings only) as disciplined one-job accents.
- **Type:** Playfair Display (headers, voice) + Inter (body, UI).
- **Aesthetic:** dark leather library with a wink. Dark mode default.
- **Photo treatment:** light sepia overlay (CSS filter, toggleable per-context, originals always preserved at full color).
- **Signature element:** etched section dividers (`─────  THE CLUB SAYS  ─────`).
- **Identity convention:** "first name + last initial" everywhere via single formatter.

---

## 9. Technical stack and architecture

### 9.1 Stack
- **Frontend:** Next.js (App Router) PWA on Vercel. iPhone-first responsive. Dark mode default.
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions).
- **Vector search:** Supabase pgvector for image embeddings.
- **AI:** OpenAI (GPT-4o-mini for chip→wheel mapping, GPT-4 Vision for identification, OpenAI embeddings or CLIP-via-Replicate for image embeddings).
- **Auth:** Supabase magic links + invite-token gate.

### 9.2 Schema sketch (Postgres)

```
users            (id, name_first, name_last_initial, role, joined_at, ...)
invites          (id, token, created_by, used_by, expires_at)
events           (id, name, date, host_user_id, notes)

products         (id, type, name, brand, line, image_url, specs_jsonb,
                  wheel_version, wheel_vector_jsonb, trait_vector_jsonb,
                  status, source, created_at)
product_images   (id, product_id, image_url, embedding vector,
                  contributed_by, is_hero)
product_reviews  (id, product_id, source, source_url, text, extracted_vector_jsonb)

tastings         (id, user_id, product_id, event_id, recommend bool,
                  chips text[], note text,
                  wheel_version, wheel_vector_jsonb, created_at)

pairings_cache   (cigar_id, bourbon_id, score, rationale_text,
                  is_group_validated, last_computed_at)

flavor_wheels    (version, type, json) -- versioned snapshots
```

### 9.3 Routes (high-level)
- `/` — feed (recent tastings across the club, filterable)
- `/capture` — camera + cigar/bourbon toggle
- `/products/[id]` — product detail (group voice)
- `/pairings/[cigarId]/[bourbonId]?` — pairing suggestion screen
- `/members/[id]` — member profile (their tastings)
- `/events/[id]` — meetup recap
- `/settings` — preferences, invite generation (admin)
- `/api/identify` — POST photo → product
- `/api/tastings` — POST tasting → maps wheel + saves
- `/api/pairings/suggest?cigarId=...` — returns top 3

---

## 10. v1 scope (must include)

- Auth: invite-only signup, magic link
- Capture screen with photo identification
- Product detail with group voice (recommend bar, member takes, tag cloud, pairings)
- Tasting flow (capture → recommend → optional chips/note → save)
- Group feed (filterable by member, event)
- Pairing suggestion screen (rules-based engine + Bartender prose)
- Member profile (their tastings, their recommendations)
- Event/meetup view (tastings grouped by night)
- Admin: invite generation, product correction
- The Bartender's voice in all designated moments
- Design system fully implemented

---

## 11. Explicit non-goals for v1

- No humidor / inventory tracking
- No offline-first (graceful degradation only)
- No public profiles or social features beyond the 12 members
- No star ratings, 1–100 scores, or sliders in any user-facing form
- No native iOS app — PWA only
- No real-time chat or messaging
- No ML-based pairing — rules only
- No automated content moderation (12 people, trust each other)

---

## 12. Risks and open questions

### 12.1 Identification accuracy
- Cigar bands of limited/boutique releases are the hardest. CLIP embedding match against a seeded catalog is the only real defense. Fallback path: member edits the AI's guess.

### 12.2 Cigar vocabulary mapping
- User noted cigars are harder than bourbon. Plan to weight prompt-tuning and synonym expansion toward the cigar wheel during the first 30 days of production usage.

### 12.3 Cold start
- Pairings before any group data exist must work on theoretical math + seeded product descriptor enrichment. Acceptable but transparent ("club hasn't tested this yet").

### 12.4 Hosting cost
- OpenAI calls per photo are the biggest variable. Estimate: ~$0.03 per identification (Vision + structured extraction) + ~$0.005 per chip→wheel mapping. At 100 tastings/month = ~$3.50/month in AI. Negligible. Vercel + Supabase free tiers should handle 12 users for v1.

### 12.5 Bartender's name
- "The Bartender" is a working title. App constant; trivial rename when the club decides.

### 12.6 Stewardship long-term
- Sole-admin model (the builder). If the builder steps away, the app becomes unmaintainable. Worth designing minimal-touch ops (managed Supabase, no custom infra).

---

## 13. Success criteria for v1

- All 12 members onboarded within 2 weeks of launch.
- At least 8 members log a tasting in the first monthly meetup post-launch.
- ≥ 90% of cigar/bourbon scans correctly identified (member doesn't need to manually correct).
- The Bartender's voice consistently delights and never grates (subjective; gather feedback at month 1).
- Pairing engine produces at least one "huh, I want to try that" reaction per member per month.

---

## 14. Artifacts already produced (read these before planning)

1. **Design system:** `/Volumes/Lexar/NCCC/docs/design-system.md` (v0.2)
2. **Cigar flavor wheel:** `/Volumes/Lexar/NCCC/data/flavor-wheels/cigar-wheel-v1.json`
3. **Bourbon flavor wheel:** `/Volumes/Lexar/NCCC/data/flavor-wheels/bourbon-wheel-v1.json`
4. **Wheel schema doc:** `/Volumes/Lexar/NCCC/data/flavor-wheels/wheel-schema.md`
5. **Project memory:** `/Users/homevestors/.claude/projects/-Volumes-Lexar-NCCC/memory/project_nccc_app.md`

---

*v1.0 · 2026-05-20 · Ready for /deep-plan ingestion.*
