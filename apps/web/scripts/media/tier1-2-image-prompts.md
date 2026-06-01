# NCCC bourbon glamour shots — prompt kit

Goal: original, post-worthy photos of **our actual bottles** by re-staging each
catalog photo into evocative settings. Use OpenAI **`gpt-image-1` image-edit
(reference) mode** — pass the catalog photo as the input image so the real
bottle is preserved. Pure text-to-image will invent a fake label; don't use it.

## How it runs (per bottle)

1. Download the bottle's `image_url` (from the manifest CSV).
2. Call `images.edit` with `model: "gpt-image-1"`, the photo as `image`, and
   one of the scene prompts below.
3. Save output as `{id}--{slug}.png`.

## Shared base prompt (prepended to every scene)

> Editorial product photograph of THIS exact bourbon bottle — preserve its real
> shape, glass color, fill level, capsule, and label artwork exactly as shown in
> the reference; do not redesign or relabel it. Keep the label legible and
> sharp. Photorealistic, shallow depth of field, premium spirits-magazine
> styling, warm amber tones, no text overlays, no people's faces. Square 1:1.

## Scene library (the `{scene}` slot)

1. **Daylight on a table** — "on a reclaimed-oak table by a bright window,
   soft morning daylight, clean minimal background, a few dust motes in the
   light."
2. **Table with a half-poured glass** — "beside a crystal rocks glass holding
   two fingers of bourbon over a large clear ice cube, warm side light, bokeh
   background of a cozy room."
3. **Night on a table** — "on a dark walnut table at night, single warm lamp
   from the left, deep shadows, moody low-key lighting, rich blacks."
4. **With a lit cigar** — "next to a lit cigar resting in a heavy crystal
   ashtray, a thin ribbon of smoke, dim amber bar lighting, leather and wood
   tones."
5. **By a fireplace at night** — "on a stone hearth in front of a crackling
   fireplace at night, warm orange firelight glow, flickering highlights on the
   glass, intimate atmosphere."
6. **Leather club chair / library** — "on a side table beside a tufted leather
   club chair in a dim wood-paneled library, brass lamp glow, classic gentleman's
   study mood."
7. **Rainy window** — "on a windowsill at night with rain streaking the glass,
   city lights blurred behind, cool blue exterior against warm interior lamp
   light."
8. **Outdoor patio at golden hour** — "on a wooden patio rail at golden hour,
   sun flaring low behind it, soft summer-evening warmth, blurred greenery."

## Tips

- **Aspect:** 1:1 reads best in the feed; use 4:5 (`1024x1280`) for a taller
  hero crop.
- **Quality:** `quality: "high"` for hero shots; `"medium"` is cheaper for bulk.
- **Consistency:** keep the base prompt identical across scenes so the bottle
  stays recognizably the same across the set.
- **Label fidelity:** review each result; regenerate any where the label text
  drifted. Mood/distance shots are safest; avoid macro label close-ups.
- **The 6 bottles with no catalog photo** can't use reference mode — either snap
  a quick photo via the app first, or skip them.
