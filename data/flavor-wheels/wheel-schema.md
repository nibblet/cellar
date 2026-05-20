# NCCC Flavor Wheel — Schema & Conventions

The flavor wheel is the silent brain of NCCC. It never appears in the UI as sliders. Instead:

1. **On capture**, the LLM extracts descriptor scores (0–5) from the user's chips + freeform notes against this fixed taxonomy.
2. **On display**, the most frequent leaves across the group's tastings render as a tag cloud ("most mentioned by NCCC").
3. **On pairing**, the pairing engine reasons over `pairing_traits` to match cigar profiles with bourbon profiles.

There are two wheels — `cigar-wheel-v1.json` and `bourbon-wheel-v1.json` — sharing this schema. They are deliberately separate because the vocabularies overlap but don't match (e.g., "barnyard" is meaningful for cigars but not bourbon; "rye spice" is bourbon-specific).

---

## Why ~35–40 leaves and not more

- More than ~40 and the LLM starts splitting hairs ("is this caramel or butterscotch or toffee?"). Noise increases, signal doesn't.
- Fewer than ~25 and the pairing engine can't distinguish profiles cleanly.
- 35–40 is the sweet spot validated by Distiller (84 tags is too many for casual use; their UI groups them) and the Council of Whiskey Masters wheel.

The leaves are chosen for what *actual tasting notes* in club-friendly reviews mention most — not what an expert sommelier would identify.

---

## File structure

```jsonc
{
  "version": "0.1",
  "type": "cigar" | "bourbon",
  "updated": "2026-05-20",

  "categories": [
    {
      "id": "wood",          // stable, lowercase, snake_case
      "label": "Wood",       // display string
      "order": 1,            // display order in any UI surface
      "description": "..."   // one-line explainer
    }
  ],

  "leaves": [
    {
      "id": "cedar",                       // stable identifier — NEVER change after v1
      "label": "cedar",                    // display string (chip text)
      "category_id": "wood",               // FK to a category id above
      "synonyms": ["cedarwood", "spanish cedar"],  // alt terms LLM maps to this leaf
      "common_in_reviews": true,           // surfaced earlier in autocomplete
      "pairing_traits": ["woody", "dry"]   // abstract axes for the pairing engine
    }
  ]
}
```

### Field conventions

- **`id`** is the canonical key. Once published, it never changes — tasting records reference it. Use `kebab-case` for multi-word ids (`stone-fruit`, `dried-fruit`).
- **`label`** is what humans see. Lowercase by default; UI applies capitalization where needed.
- **`synonyms`** is the LLM's friend. Be generous — 3–6 alternates per leaf. Include slang ("barnyard"), specifics ("Tellicherry peppercorn"), and common misspellings if relevant.
- **`common_in_reviews`** is a heuristic flag. Leaves marked `true` rank higher in chip autocomplete and in tag clouds when frequencies tie. Roughly 60% of leaves should be true.
- **`pairing_traits`** are abstract axes shared across both wheels — the pairing engine uses these to compare cigar profiles to bourbon profiles. Keep to 1–2 per leaf. See the fixed trait list below.

### Fixed pairing-trait vocabulary (shared across both wheels)

A leaf can carry 0–2 of these. Adding new traits requires a wheel version bump.

| Trait | Meaning | Example leaves |
|---|---|---|
| `sweet` | Contributes sweetness | vanilla, honey, caramel, chocolate |
| `creamy` | Soft, rounded, dairy-like | vanilla, butterscotch, milk-chocolate |
| `warm` | Warm baking spice | cinnamon, clove, nutmeg |
| `sharp` | Sharp/pungent spice | black-pepper, ginger |
| `woody` | Wood-derived | oak, cedar, char |
| `earthy` | Soil, leather, forest floor | leather, soil, hay, musk |
| `roasted` | Heat-transformed, dark | coffee, toast, char |
| `bright` | Fresh, citrus, floral lift | citrus, floral, mint |
| `dry` | Astringent, tannic, savory | tobacco, hay, leather |
| `fruity` | Fruit-derived | apple, cherry, dried-fruit |

---

## How a tasting becomes a wheel vector

When a member taps "Recommend" and adds chips like `[cocoa, leather, pepper]` plus the note "stronger than expected, coffee on the retrohale", an LLM call returns:

```json
{
  "wheel_version": "0.1",
  "wheel_type": "cigar",
  "scores": {
    "cocoa": 4,
    "leather": 4,
    "black-pepper": 3,
    "coffee": 4,
    "cedar": 1
  },
  "confidence": "high"
}
```

Only leaves with score ≥ 1 are stored — the vector is sparse. The user never sees this.

---

## Versioning

- Wheels are versioned (`v1`, `v2`...). A wheel version is a frozen artifact.
- Tastings store the `wheel_version` they were rated under. The aggregation layer reconciles across versions (this is rare in practice; we'll plan for it but won't optimize until needed).
- **Never** repurpose an existing `id` for a new meaning. Add new ids, deprecate old ones.

---

## How to evolve the wheels

We expect to refine these wheels over the first 6 months based on:
- Frequency of "other" chip text that doesn't match any leaf or synonym
- Pairing recommendations that members rate poorly (signals a flavor axis we're missing)
- Member feedback ("we keep using the word X and the app doesn't get it")

Process:
1. Collect 30+ days of unmapped chip text from production
2. Cluster, propose leaf additions or synonym expansions
3. Bump the wheel version, publish, run a re-mapping job over historical tastings
