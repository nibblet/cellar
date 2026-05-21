import { PAIRING_TRAITS, type TraitVector } from "@/lib/wheel";

const TRAIT_LABEL: Record<(typeof PAIRING_TRAITS)[number], string> = {
  sweet: "Sweet",
  creamy: "Creamy",
  warm: "Warm",
  sharp: "Sharp",
  woody: "Woody",
  earthy: "Earthy",
  roasted: "Roasted",
  bright: "Bright",
  dry: "Dry",
  fruity: "Fruity",
};

// SVG geometry. The drawn radar lives inside a 320×320 box centered at
// (CENTER, CENTER); the viewBox extends 50px on each side so axis labels
// (typically 40–60px wide) don't clip at the leftmost / rightmost axes.
const SIZE = 320;
const LABEL_MARGIN = 56;
const VIEWBOX = `${-LABEL_MARGIN} 0 ${SIZE + LABEL_MARGIN * 2} ${SIZE}`;
const PADDING = 32;
const RADIUS = (SIZE - PADDING * 2) / 2;
const CENTER = SIZE / 2;
const RINGS = [0.25, 0.5, 0.75, 1.0];

/**
 * Read-only 10-axis radar showing a product's catalog-baseline
 * `trait_vector`. The full Tier 2 #4 scope adds layered member adjustments
 * and a club-consensus moss fill on top of this shape; v1 ships only the
 * baseline so the visual primitive is in place and the schema work for
 * `product_adjustments` can land separately.
 *
 * Pure SVG, no client JS. Renders into a fixed 320×320 viewport that
 * scales responsively via `width="100%"`.
 */
export function TraitRadar({ vector, label }: { vector: TraitVector; label?: string }) {
  const axisPoints = PAIRING_TRAITS.map((_, i) => {
    // Start at top (-π/2), go clockwise.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / PAIRING_TRAITS.length;
    return { angle, cos: Math.cos(angle), sin: Math.sin(angle) };
  });

  const valuePoints = PAIRING_TRAITS.map((trait, i) => {
    const v = clamp01(vector[trait]);
    const { cos, sin } = axisPoints[i];
    return {
      x: CENTER + v * RADIUS * cos,
      y: CENTER + v * RADIUS * sin,
    };
  });
  const valuePath = `M ${valuePoints.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")} Z`;

  return (
    <figure className="flex flex-col items-center">
      <svg
        viewBox={VIEWBOX}
        width="100%"
        className="max-w-[420px]"
        role="img"
        aria-label={`Trait radar${label ? ` for ${label}` : ""}`}
      >
        {/* Background rings */}
        {RINGS.map((r) => (
          <polygon
            key={r}
            points={axisPoints
              .map(({ cos, sin }) => {
                const x = CENTER + r * RADIUS * cos;
                const y = CENTER + r * RADIUS * sin;
                return `${x.toFixed(2)},${y.toFixed(2)}`;
              })
              .join(" ")}
            fill="none"
            className="stroke-border"
            strokeWidth={r === 1.0 ? 1 : 0.5}
          />
        ))}

        {/* Axis spokes */}
        {axisPoints.map(({ cos, sin }, i) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: stable axis order
            key={i}
            x1={CENTER}
            y1={CENTER}
            x2={CENTER + RADIUS * cos}
            y2={CENTER + RADIUS * sin}
            className="stroke-border"
            strokeWidth={0.5}
          />
        ))}

        {/* Value polygon — moss tint (the silent "this is the shape") */}
        <path
          d={valuePath}
          className="fill-moss-600/15 stroke-moss-600"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Value dots */}
        {valuePoints.map((p, i) => (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: stable axis order
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.5}
            className="fill-moss-600"
          />
        ))}

        {/* Axis labels */}
        {axisPoints.map(({ cos, sin }, i) => {
          const trait = PAIRING_TRAITS[i];
          const lr = RADIUS + 18;
          const x = CENTER + lr * cos;
          const y = CENTER + lr * sin;
          // Nudge anchor based on quadrant so labels don't crash into spokes.
          const anchor = Math.abs(cos) < 0.15 ? "middle" : cos > 0 ? "start" : "end";
          const baseline = Math.abs(sin) < 0.15 ? "middle" : sin > 0 ? "hanging" : "alphabetic";
          return (
            <text
              // biome-ignore lint/suspicious/noArrayIndexKey: stable axis order
              key={i}
              x={x.toFixed(2)}
              y={y.toFixed(2)}
              textAnchor={anchor}
              dominantBaseline={baseline}
              className="fill-foreground-muted text-[10px] uppercase tracking-widest"
            >
              {TRAIT_LABEL[trait]}
            </text>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-[10px] uppercase tracking-widest text-foreground-subtle">
        Catalog baseline
      </figcaption>
    </figure>
  );
}

function clamp01(v: number | undefined): number {
  if (v == null || Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
