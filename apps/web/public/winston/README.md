# Winston illustration assets

Source PNGs for the unicorn mascot. Surface assignments locked in
`planning/nccc-roadmap.md` Tier 3 #10. Rendered via the
`<Winston variant=… />` component in `apps/web/src/components/brand/winston.tsx`.

| File | Variant | Used on |
|---|---|---|
| `winston-library.png` | Library scene (narrative) | `/welcome` first-run onboarding |
| `winston-splash.png` | Full-figure splash | `/login`, `/accept-invite` |
| `winston-bust.png` | Header bust | Lounge empty state, Pairings index header, "Winston suggests" header |
| `winston-glass.png` | Glass-offering roundel | Inline ornament above "Pairs with" divider on product detail |
| `winston-pour.png` | Active-pour pose | Daily Pour hero card accent |

All variants are hand-inked, monochrome line work. See
`docs/design-system.md` §6 for voice + illustration rules.

The recap card surface (`/events/[id]/recap`) is documented in the roadmap
as a future splash target, but the recap route does not yet exist on disk;
add the `<Winston variant="splash" />` placement when the route ships.
