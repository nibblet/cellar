# NCCC — Design System v0.1

The visual and tonal foundation for the Norton Commons Cigar Club app.

Everything here derives from one source: the logo. A monocle-less unicorn in a smoking jacket, hand-inked, monochrome, gentlemanly with a wink. The app should feel like an extension of that drawing — confident, warm, a little funny, never stuffy.

---

## 1. Principles

**Confident, not loud.** Brass accents do the work of color. Type does the work of hierarchy. No gradients, no neon, no pastels.

**Library, not museum.** Warm and inviting. The app should feel like the room the club meets in, not a curator's display case.

**The wink is in the details.** The unicorn, the etched dividers, the Bartender's voice. Refinement with a smirk. Never sarcasm.

**One primary action per screen.** Brass is reserved for the thing we want you to tap.

**Math hidden, voice shown.** The flavor wheel is invisible infrastructure. What members see is each other's words.

---

## 2. Color tokens

The palette is the logo: black ink on cream, with brass as the only chromatic accent.

| Token | Hex | Usage |
|---|---|---|
| `--ink-900` | `#1A1613` | Body text, primary type. Near-black with a brown undertone (not pure black — pure black is too sterile against cream). |
| `--ink-700` | `#3A3128` | Secondary text, dimmed elements. |
| `--ink-500` | `#6B5D52` | Tertiary text, captions, meta. |
| `--paper-50` | `#F7F1E6` | App background. Warm cream, the color of aged paper. |
| `--paper-100` | `#EFE7D6` | Card backgrounds, subtle elevation. |
| `--paper-200` | `#E4D8C0` | Dividers, borders, disabled states. |
| `--brass-500` | `#B08A4A` | The accent. Buttons, recommend bar fill, highlighted links. |
| `--brass-600` | `#8E6E38` | Hovered/pressed brass. |
| `--brass-100` | `#E8DCC0` | Brass tint for subtle backgrounds (chip selected state). |
| `--ember-500` | `#C2410C` | Reserved. The lit-cigar tip color. Used only for the "recommend" icons (lit cigars / filled glencairns) and nowhere else. |
| `--moss-600` | `#4A5D3A` | Reserved. The "club has tested this" pairing indicator. Used sparingly. |

**Dark mode** (because most use is at night, in dim rooms):

| Token | Hex |
|---|---|
| `--ink-900` (dark) | `#F0E6D2` (becomes light) |
| `--paper-50` (dark) | `#15110C` (deep cocoa-black) |
| `--paper-100` (dark) | `#1F1912` |
| `--brass-500` (dark) | `#D4A862` (slightly brighter for contrast) |

Dark mode is the **default**. Light mode exists but most members will live in dark.

---

## 3. Typography

Two typefaces. One for voice (serif, etched), one for utility (sans, humble).

**Display & headers — `Playfair Display`** (Google Fonts)
- High-contrast didone serif with weight and presence. Reads more masculine than a garamond — fits the unicorn-with-cigar attitude.
- Weights used: 600 (subheads), 800 (titles).
- Tracking: -0.015em for titles (tight, declarative), 0 for subheads.

**Body & UI — `Inter`** (Google Fonts)
- Humble, legible on small screens, gets out of the way.
- Weights: 400 (body), 500 (UI labels), 600 (emphasis).
- Tracking: 0 for body, +0.04em for ALL-CAPS section labels.

**Voice — `Playfair Display Italic`** (500 weight)
- Reserved for The Bartender's lines. When he speaks, he uses serif italic. This is how the user knows it's him. Italic Playfair has a calligraphic flourish that suits the gentlemanly tone.

**Type scale (mobile baseline)**:

| Token | Size | Line | Use |
|---|---|---|---|
| `display` | 32 / 36 | 1.1 | Splash, big moments only |
| `title` | 22 / 26 | 1.2 | Product names, screen titles |
| `subtitle` | 16 / 18 | 1.3 | Secondary product info |
| `label` | 11 / 12 | 1.2, +0.08em tracking, ALL CAPS | Section dividers ("THE CLUB SAYS") |
| `body` | 16 | 1.5 | Reading text, member takes |
| `meta` | 13 | 1.4 | Timestamps, captions |
| `voice` | 17 italic serif | 1.5 | The Bartender |

---

## 4. Spacing & layout

4px base unit. Use multiples: `4, 8, 12, 16, 24, 32, 48, 64`.

Mobile gutters: 20px (one-thumb territory). Cards inset 16px internally.

Touch targets: 44×44 minimum. Primary CTAs are 56px tall — meant to be tapped from a recliner, half-buzzed.

---

## 5. Component primitives

### Buttons

**Primary** — brass fill, ink-900 text, no border, 56px tall, 12px radius. One per screen. Ever.
```
┌─────────────────────────────────┐
│   ⭢   Recommend to NCCC        │← --brass-500 background
└─────────────────────────────────┘   ink-900 text, weight 500
```

**Secondary** — paper-100 background, ink-700 text, 1px paper-200 border, 48px tall.

**Ghost** — transparent, ink-700 text, no border. For "Skip", "Edit", inline links.

**No pill shapes.** Subtle 12px radius. We're a library, not a startup.

### Cards

`--paper-100` background. 1px `--paper-200` border. 16px radius (slightly softer than buttons). 16px internal padding. Drop shadow is **a single hairline below**, not a gaussian blur:

```css
box-shadow: 0 1px 0 rgba(26, 22, 19, 0.06);
```

### Dividers — the etched section breaks

This is the signature element. Not a 1px line — a small phrase set between two short rules.

```
─────  THE CLUB SAYS  ───────────
```

- Rules are 1px `--paper-200`, ~24px long on each side.
- Label is `label` token (11px, ALL CAPS, +0.08em tracking, `--ink-500`).
- 32px vertical breathing room above and below.

These are used at every major section break. They're the visual seasoning that makes the app feel like a printed page.

### Chips

Pill-shaped, but flat — no shadow, no gradient.

- **Default**: `--paper-100` bg, `--ink-700` text, 1px `--paper-200` border, 8/12px padding.
- **Selected**: `--brass-100` bg, `--ink-900` text, 1px `--brass-500` border.
- Autocompletes from the flavor wheel but accepts arbitrary text.

### Member tag — universal identity element

```
🟢 Paul C
```

- Avatar dot (12px) + name (`body`, 500 weight) inline.
- Dot color = recommend status (`--ember-500` lit / `--ink-500` dim) when used in product takes; `--paper-200` neutral elsewhere.
- Format ALWAYS first-name-last-initial. Code constant: `formatMemberName(user) → "Paul C"`.

### Recommend icons (the bar)

The visceral status indicator. Cigars for cigars, glencairns for bourbon.

```
🚬🚬🚬🚬🚬🚬⚪⚪      6 of 8
```

- Custom SVG icons matching the logo's ink-drawn line style.
- Lit state: `--ember-500` glow at the cigar tip, full ink elsewhere.
- Dim state: `--ink-500` outline only, no fill.
- Always followed by "N of M" in `meta` type, then a `label` caption below.

### Hero image treatment

User-contributed photos get a **light sepia overlay** to unify the gallery — all photos start to look like they belong in the same archive.

**Implementation: a toggleable CSS filter layer, not baked into the stored image.** The original photo is always preserved at full color in storage; the sepia is purely a presentation-layer effect we can dial down, disable, or remove later if the club ever wants true color.

```css
.nccc-photo {
  filter: sepia(0.35) saturate(0.85) contrast(1.02);
}
.nccc-photo--overlay::after {
  /* paper-tint pass, multiply blend */
  background: var(--paper-100);
  mix-blend-mode: multiply;
  opacity: 0.08;
}
```

Wrap every hero/thumbnail in a `<PhotoFrame sepia={true|false}>` component so the treatment is a single prop we can flip globally or per-context (e.g., sepia in feed, true-color in product detail) without touching image data.

The light-touch (sepia 0.35, not 0.7) keeps the cigar wrapper readable while still pulling everything toward the ink-on-cream universe.

---

## 6. The Bartender — illustration & voice

### Where he appears
- Splash / loading transitions
- Empty states ("No tastings yet. Snap your first.")
- Recommendation screen header ("The Bartender suggests...")
- System messages (welcome, errors handled gracefully, end-of-night recap intro)

### Where he does NOT appear
- The capture screen (gets out of the way)
- The feed (too noisy)
- The product detail page (the group is the voice there, not him)

### Voice rules
- Speaks in `voice` type (Cormorant italic).
- Dry, refined, slightly archaic. Never modern startup-speak.
- One sentence, sometimes two. Never a paragraph.
- Sample lines:
  - Empty humidor: *"Nothing logged yet, sir. The night is young."*
  - First-time pairing: *"A combination the club has not yet tried. I trust your verdict."*
  - Photo fails: *"I couldn't make out the band. Try again, or name it yourself?"*
  - End of night: *"A fine evening. Three new entries for the archive."*
- He never says "user". He says "sir" or addresses by first name when known.

### Illustration treatment
- Hand-inked line work matching the logo.
- Variants: full-figure (splash), bust (header), single-hand-holding-glass (small UI moments).
- Always monochrome ink. Never colored.
- Optional: a small smoke wisp animates subtly on idle empty states.

---

## 7. Iconography

- Line-drawn, 1.5px stroke, matched to the logo's weight.
- Rounded line caps and joins.
- No fills (except recommend icons).
- 24×24 grid.
- Custom set for: cigar, glencairn, ashtray, humidor, calendar (meetup), recommend-arrow, share, edit-band.

Stock icon libraries (Lucide, etc.) can be used internally during build, but the final app uses custom SVGs in this style for at least the 8 icons above.

---

## 8. Motion

Restrained. We're a library, not a TikTok.

- **Reveals** (photo → ID): 400ms ease-out, slight scale-from-95%. Like flipping a card.
- **Recommend tap**: brass button briefly inverts (text → bg, bg → text) for 120ms, then a soft confirmation toast.
- **Bartender appearances**: 600ms fade-in with a subtle 2px upward drift.
- **No bounces.** No spring physics. Everything eases like a closing door.

---

## 9. Accessibility floors

- All text meets WCAG AA against its background. Brass-on-paper is verified at AA for `label`+ sizes; never use brass for `body`.
- Recommend icons always paired with a number ("6 of 8") — never icons alone.
- Bartender's italic serif `voice` type is ≥17px to stay legible.
- Dark mode is default; light mode is a real first-class theme, not an afterthought.
- One-handed reachability: primary CTAs live in the bottom 40% of the screen.

---

## 10. Confirmed warm-palette commitment

The full active palette is intentionally warm and three-accented:
- **Brass** carries primary action and emphasis.
- **Ember** lights the recommend icons (the only place this color appears).
- **Moss** marks group-validated pairings (the only place this color appears).

Each accent has exactly one job. No re-using brass for status, no re-using ember for buttons. This discipline is what keeps a three-color palette from feeling busy.

---

## 11. What this leaves open

- **Exact illustration assets for The Bartender's variants** — needs an illustrator pass once we know the moments.
- **Final mascot name** — "The Bartender" is the working title.
- **Icon set delivery** — sketched in spec here, drawn later.
- **Onboarding visual treatment** — the first time someone opens the app should feel like opening a leather-bound book. TBD.
- **Animation specifics for the "reveal"** — the photo-to-ID transition is the signature interaction. Worth a dedicated prototype.

---

*Version 0.2 · 2026-05-20 · Living document.*

## Changelog

- **v0.2** (2026-05-20) — Header type switched to Playfair Display (more masculine). Sepia treatment dialed to light (0.35) and reimplemented as a toggleable CSS overlay component so we can revert to true color without touching stored images. Warm three-accent palette (brass + ember + moss) confirmed and disciplined to one-job-per-color.
- **v0.1** (2026-05-20) — Initial draft.
