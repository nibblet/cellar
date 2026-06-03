/**
 * generate-catalog-scenes — one glamour shot per bottle, each dropped into a
 * randomly-assigned scene so the catalog doesn't look uniform.
 *
 * It pulls catalog bourbons from the DB, and for each one with a catalog photo
 * it re-stages THAT photo (gpt-image-1 image-edit, input_fidelity: "high", so
 * the real bottle + label are preserved) into one of 8 scenes. The scene is
 * chosen by hashing the product id — stable across re-runs, evenly spread.
 *
 * The randomness lives here, not in the prompt: image models won't reliably
 * "pick one of 8" on their own, so we pick, then send only that one scene.
 *
 * Output is written locally to scripts/media/out/. Nothing in the DB or the
 * catalog changes — review the folder, then we can wire an upload step.
 *
 *   pnpm gen:catalog-scenes                  # dry run: prints the plan + scene per bottle
 *   pnpm gen:catalog-scenes --run            # actually generate (spends OpenAI credits)
 *   pnpm gen:catalog-scenes --run --limit 5  # small pilot
 *   pnpm gen:catalog-scenes --run --tiers 1  # tier 1 only (default: 1,2)
 *   pnpm gen:catalog-scenes --run --quality medium   # low (default) | medium | high
 *   pnpm gen:catalog-scenes --run --force    # regenerate even if a file exists
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI, { toFile } from "openai";
import { adminClient } from "../seed/lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "out");

const BASE_PROMPT =
  "Re-stage THIS exact bottle in the scene below. Keep the bottle precisely as " +
  "shown in the reference — its real silhouette, glass color, fill level, " +
  "capsule, and label artwork — do not redesign, relabel, or restyle it, and " +
  "keep the label text legible and faithful. Photorealistic editorial spirits " +
  "photography, warm amber tones, shallow depth of field, no people, no text " +
  "overlays. Scene: ";

const SCENES: { slug: string; text: string }[] = [
  { slug: "daylight-table", text: "on a reclaimed-oak table by a bright window in soft morning daylight, clean minimal background, faint dust motes in the light." },
  { slug: "half-poured", text: "beside a crystal rocks glass holding two fingers of bourbon over a large clear ice cube, warm side light, cozy bokeh background." },
  { slug: "night-table", text: "on a dark walnut table at night lit by a single warm lamp from the left, deep shadows, moody low-key lighting, rich blacks." },
  { slug: "lit-cigar", text: "next to a lit cigar resting across a Glencairn glass with a thin ribbon of smoke, dim amber bar lighting, leather and wood tones." },
  { slug: "fireplace", text: "on a stone hearth before a crackling fireplace at night, warm orange firelight glow flickering on the glass, intimate atmosphere." },
  { slug: "library-chair", text: "on a side table beside a tufted leather club chair in a dim wood-paneled library, brass lamp glow, classic gentleman's-study mood." },
  { slug: "rainy-window", text: "on a windowsill at night with rain streaking the glass and blurred city lights behind, cool blue exterior against warm interior lamplight." },
  { slug: "patio-golden-hour", text: "on a wooden patio rail at golden hour with the low sun flaring behind it, soft summer-evening warmth, blurred greenery." },
];

/** Stable per-bottle scene: hash the id so re-runs don't reshuffle. */
function sceneFor(id: string) {
  const n = Number.parseInt(createHash("sha1").update(id).digest("hex").slice(0, 8), 16);
  return SCENES[n % SCENES.length];
}

type Bottle = { id: string; name: string; tier: number; image_url: string };

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function csvArg(flag: string): string[] | null {
  const value = arg(flag);
  if (!value) return null;
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function main() {
  const RUN = process.argv.includes("--run");
  const FORCE = process.argv.includes("--force");
  const limit = arg("--limit") ? Number.parseInt(arg("--limit") as string, 10) : Infinity;
  const tiers = (arg("--tiers") ?? "1,2").split(",").map((t) => Number.parseInt(t, 10));
  const VALID_QUALITIES = ["low", "medium", "high"] as const;
  const VALID_SIZES = ["1024x1024", "1536x1024", "1024x1536", "auto"] as const;
  const rawQuality = arg("--quality") ?? "low";
  const rawSize = arg("--size") ?? "1024x1024";
  if (!VALID_QUALITIES.includes(rawQuality as never)) {
    throw new Error(`Unknown --quality: ${rawQuality}. Valid: ${VALID_QUALITIES.join(", ")}`);
  }
  if (!VALID_SIZES.includes(rawSize as never)) {
    throw new Error(`Unknown --size: ${rawSize}. Valid: ${VALID_SIZES.join(", ")}`);
  }
  const quality = rawQuality as (typeof VALID_QUALITIES)[number];
  const size = rawSize as (typeof VALID_SIZES)[number];
  const includeIds = csvArg("--ids");
  const excludeIds = new Set(csvArg("--exclude-ids") ?? []);

  const supa = adminClient();
  const { data, error } = await supa
    .from("products")
    .select("id, name, specs, image_url")
    .eq("type", "bourbon")
    .eq("catalog_included", true)
    .not("image_url", "is", null);
  if (error) throw error;

  const bottles: Bottle[] = (data ?? [])
    .map((r) => ({
      id: r.id as string,
      name: r.name as string,
      tier: Number.parseInt((r.specs as Record<string, unknown>)?.tier as string, 10),
      image_url: r.image_url as string,
    }))
    .filter((b) => tiers.includes(b.tier))
    .filter((b) => (includeIds ? includeIds.includes(b.id) : true))
    .filter((b) => !excludeIds.has(b.id))
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  mkdirSync(OUT_DIR, { recursive: true });

  const planned = bottles.slice(0, limit);
  console.log(`Catalog bourbons in tiers [${tiers.join(",")}] with a photo: ${bottles.length}`);
  console.log(`This run: ${planned.length}  |  quality=${quality}  size=${size}  ${RUN ? "GENERATE" : "(dry run)"}`);

  // Rough cost so nobody is surprised. gpt-image-1 edit, square output.
  const perImage = quality === "high" ? 0.17 : quality === "medium" ? 0.04 : 0.011;
  console.log(`Est. cost: ~$${(planned.length * perImage).toFixed(2)} (~$${perImage}/img at ${quality})\n`);

  if (!RUN) {
    for (const b of planned) console.log(`  T${b.tier}  ${b.name}  →  ${sceneFor(b.id).slug}`);
    console.log("\nDry run. Re-run with --run to generate.\n");
    return;
  }

  const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  let made = 0;
  let skipped = 0;
  for (const b of planned) {
    const scene = sceneFor(b.id);
    const outPath = path.join(OUT_DIR, `${b.id}--${scene.slug}.jpg`);
    if (!FORCE && existsSync(outPath)) {
      skipped++;
      continue;
    }
    try {
      const resp = await fetch(b.image_url);
      if (!resp.ok) throw new Error(`fetch image ${resp.status}`);
      const ref = await toFile(Buffer.from(await resp.arrayBuffer()), "bottle.jpg", {
        type: resp.headers.get("content-type") ?? "image/jpeg",
      });
      const result = await openai.images.edit({
        model: "gpt-image-1",
        image: ref,
        prompt: BASE_PROMPT + scene.text,
        size,
        quality,
        input_fidelity: "high",
        output_format: "jpeg",
      });
      const b64 = result.data?.[0]?.b64_json;
      if (!b64) throw new Error("no image data returned");
      writeFileSync(outPath, Buffer.from(b64, "base64"));
      made++;
      console.log(`✓ ${b.name}  →  ${scene.slug}`);
    } catch (err) {
      console.error(`✗ ${b.name}: ${(err as Error).message}`);
    }
  }
  console.log(`\nDone. Generated ${made}, skipped ${skipped} (already done). Output: ${OUT_DIR}\n`);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
