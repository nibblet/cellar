import type { SupabaseClient } from "@supabase/supabase-js";
import { fallbackProse, generatePairingProse, type PairingProse } from "@/lib/openai/pairing-prose";
import type { TraitVector } from "@/lib/wheel";
import { scorePair } from "./score";

export type { PairingProse } from "@/lib/openai/pairing-prose";

/**
 * Single-pair lookup → cached structured prose, or null when nothing has
 * been written yet. Surfaces that render many pairs at once (the Pairings
 * index, future For You ranking explanations) use this read-only path to
 * avoid burning OpenAI calls per render — they show real prose where
 * available and the engine's structured-reason fallback elsewhere.
 *
 * Backward-compat: rows written before the structured rewrite stored a
 * single string in rationale_text. When we encounter one of those, we
 * return it as `{ notes, why_bullets: [] }` so old cache entries keep
 * working until they're re-generated on next miss-or-edit.
 */
export async function loadCachedPairingProse(
  supabase: SupabaseClient,
  cigarId: string,
  bourbonId: string,
): Promise<PairingProse | null> {
  const { data } = await supabase
    .from("pairings_cache")
    .select("rationale_text")
    .eq("cigar_id", cigarId)
    .eq("bourbon_id", bourbonId)
    .maybeSingle();
  const raw = (data?.rationale_text as string | null) ?? null;
  if (!raw) return null;
  return decodeCachedProse(raw);
}

/**
 * Returns the cached PairingProse for a pair; generates + persists one if
 * the cache is empty. Use on surfaces that show ONE pair (the Daily Pour
 * hero, the dedicated pair-detail page) — surfaces showing many pairs
 * should stick to `loadCachedPairingProse` so the first render isn't an
 * N-LLM-call cliff.
 *
 * On any error the engine-derived fallback is returned without being
 * cached, so the next call can retry generation. We also regenerate (and
 * overwrite) when the cached row is a legacy plain-string entry with no
 * why_bullets — that's how the new structured shape backfills naturally
 * without a one-shot migration.
 */
export async function ensurePairingProse(
  supabase: SupabaseClient,
  cigarId: string,
  bourbonId: string,
): Promise<PairingProse> {
  const cached = await loadCachedPairingProse(supabase, cigarId, bourbonId);
  if (cached && cached.why_bullets.length > 0) return cached;

  const [{ data: cigar }, { data: bourbon }] = await Promise.all([
    supabase.from("products").select("name, brand, trait_vector").eq("id", cigarId).maybeSingle(),
    supabase.from("products").select("name, brand, trait_vector").eq("id", bourbonId).maybeSingle(),
  ]);

  if (!cigar?.trait_vector || !bourbon?.trait_vector) {
    return cached ?? fallbackProse({ reasons: [], score: 0 });
  }

  const { score, reasons } = scorePair(
    cigar.trait_vector as TraitVector,
    bourbon.trait_vector as TraitVector,
  );

  try {
    const { data: auth } = await supabase.auth.getUser();
    const prose = await generatePairingProse({
      cigar: { name: cigar.name as string, brand: (cigar.brand as string | null) ?? null },
      bourbon: { name: bourbon.name as string, brand: (bourbon.brand as string | null) ?? null },
      reasons,
      score,
      supabase,
      userId: auth.user?.id ?? null,
    });

    // Await the persistence: under the Next 16 server-component lifecycle,
    // fire-and-forget upserts are cancelled when the response ships, so
    // without this every render misses the cache and re-generates prose.
    await supabase.from("pairings_cache").upsert(
      {
        cigar_id: cigarId,
        bourbon_id: bourbonId,
        score,
        rationale_text: JSON.stringify(prose),
      },
      { onConflict: "cigar_id,bourbon_id" },
    );

    return prose;
  } catch (err) {
    console.warn("[ensurePairingProse] generation failed:", err);
    return cached ?? fallbackProse({ reasons, score });
  }
}

/**
 * Decode whatever `rationale_text` stored. The structured shape is JSON-
 * stringified; older rows are plain prose. Detect the shape lightly — JSON
 * payloads start with `{` after trimming — and fall back to treating the
 * whole string as legacy `notes`.
 */
function decodeCachedProse(raw: string): PairingProse {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<PairingProse>;
      if (typeof parsed.notes === "string") {
        return {
          notes: sanitizeProse(parsed.notes),
          why_bullets: Array.isArray(parsed.why_bullets)
            ? parsed.why_bullets.filter((b): b is string => typeof b === "string" && b.length > 0)
            : [],
        };
      }
    } catch {
      // fall through to legacy decode
    }
  }
  return { notes: sanitizeProse(trimmed), why_bullets: [] };
}

/**
 * Defensive cleanup of cached prose: earlier rows were saved before the
 * generator stripped markdown emphasis, so old entries can carry leading
 * or trailing `*` / `_` characters. Applying the same strip on read means
 * we don't need a backfill migration.
 */
function sanitizeProse(input: string): string {
  let text = input.trim();
  text = text.replace(/^[*_]+/, "").replace(/[*_]+$/, "");
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("“") && text.endsWith("”"))
  ) {
    text = text.slice(1, -1);
  }
  return text.trim();
}
