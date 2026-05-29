import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS, openai } from "@/lib/openai/client";
import { estimateCost, logUsage } from "@/lib/usage/log";

export type CellarInsight = {
  bourbons: string | null;
  cigars: string | null;
  generated_at: string;
  have_hash: string;
};

type ShelfProduct = {
  product_id: string;
  name: string;
  brand: string | null;
  type: string;
  specs: Record<string, unknown> | null;
};

const SYSTEM_PROMPT = `You are Winston, the resident narrator at the Norton Commons Cigar Club — gentlemanly, dry, slightly archaic. You speak in serif italic; assume that's how the user sees it. Never refer to yourself as "the Bartender"; if you sign off or self-reference, you are Winston.

You are analyzing a club member's personal cellar — the products they currently have on hand. Give a personality read of their collection with fun stats woven in. Think of it as a sommelier glancing at someone's bar cart and cigar humidor and making observations.

Return JSON with this exact shape:
{
  "bourbons": "<2-3 sentences about their bourbon collection, or null if they have none>",
  "cigars": "<2-3 sentences about their cigar collection, or null if they have none>"
}

Rules:
- 2 to 3 sentences per section. Never more.
- Lead with a fun stat or observation (count, proof range, dominant origin, etc.) then characterize their taste.
- Be specific: name distilleries, regions, wrapper types, proof ranges — whatever the data supports.
- Note gaps or blind spots when interesting ("Not a wheated bottle in sight", "No Connecticut shades on the shelf").
- Address the reader directly; "sir" used once at most per section.
- Warm and witty, never condescending. The wink is in the details.
- Plain prose. Never use markdown emphasis (no asterisks, underscores, or backticks). The italic styling is applied by the renderer.
- If a category has fewer than 2 items, keep the insight to one short sentence.
`;

export function computeHaveHash(productIds: string[]): string {
  const sorted = [...productIds].sort();
  return createHash("sha256").update(sorted.join(",")).digest("hex").slice(0, 16);
}

export async function loadCachedInsight(
  supabase: SupabaseClient,
  memberId: string,
): Promise<CellarInsight | null> {
  const { data } = await supabase
    .from("users")
    .select("cellar_insight")
    .eq("id", memberId)
    .maybeSingle();

  const raw = data?.cellar_insight as CellarInsight | null;
  if (!raw || typeof raw.have_hash !== "string") return null;
  return raw;
}

export async function loadShelfProducts(
  supabase: SupabaseClient,
  memberId: string,
): Promise<ShelfProduct[]> {
  const { data } = await supabase
    .from("member_saves")
    .select("product_id, products!inner(id, name, brand, type, specs)")
    .eq("member_id", memberId)
    .eq("have", true)
    // Mirror the member-facing catalog cut-back: don't count the hidden
    // long tail. Cigars default catalog_included=true, so this only trims
    // de-listed bourbons.
    .eq("products.catalog_included", true);

  if (!data) return [];

  type JoinedRow = {
    product_id: string;
    products:
      | {
          id: string;
          name: string;
          brand: string | null;
          type: string;
          specs: Record<string, unknown> | null;
        }
      | Array<{
          id: string;
          name: string;
          brand: string | null;
          type: string;
          specs: Record<string, unknown> | null;
        }>;
  };

  return (data as unknown as JoinedRow[]).map((row) => {
    const p = Array.isArray(row.products) ? row.products[0] : row.products;
    return {
      product_id: row.product_id,
      name: p?.name ?? "",
      brand: p?.brand ?? null,
      type: p?.type ?? "",
      specs: (p?.specs as Record<string, unknown>) ?? null,
    };
  });
}

function buildUserMessage(products: ShelfProduct[]): string {
  const bourbons = products.filter((p) => p.type === "bourbon");
  const cigars = products.filter((p) => p.type === "cigar");

  const lines: string[] = [];

  if (bourbons.length > 0) {
    lines.push(`BOURBONS ON SHELF (${bourbons.length}):`);
    for (const b of bourbons) {
      const specs = b.specs ?? {};
      const details: string[] = [];
      if (specs.proof) details.push(`${specs.proof} proof`);
      if (specs.age) details.push(`${specs.age}yr`);
      if (specs.mashbill_type) details.push(String(specs.mashbill_type));
      if (specs.distillery) details.push(String(specs.distillery));
      const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";
      lines.push(`- ${b.brand ? `${b.brand} — ` : ""}${b.name}${suffix}`);
    }
  }

  if (cigars.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push(`CIGARS ON SHELF (${cigars.length}):`);
    for (const c of cigars) {
      const specs = c.specs ?? {};
      const details: string[] = [];
      if (specs.strength) details.push(String(specs.strength));
      if (specs.wrapper) details.push(`${specs.wrapper} wrapper`);
      if (specs.origin) details.push(String(specs.origin));
      if (specs.vitola) details.push(String(specs.vitola));
      const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";
      lines.push(`- ${c.brand ? `${c.brand} — ` : ""}${c.name}${suffix}`);
    }
  }

  return lines.join("\n");
}

export async function generateCellarInsight(
  products: ShelfProduct[],
  supabase: SupabaseClient,
  userId: string,
): Promise<CellarInsight> {
  const haveHash = computeHaveHash(products.map((p) => p.product_id));

  if (products.length === 0) {
    return {
      bourbons: null,
      cigars: null,
      generated_at: new Date().toISOString(),
      have_hash: haveHash,
    };
  }

  const userMessage = buildUserMessage(products);

  const completion = await openai().chat.completions.create({
    model: MODELS.prose,
    reasoning_effort: "minimal",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const tokensIn = completion.usage?.prompt_tokens ?? 0;
  const tokensOut = completion.usage?.completion_tokens ?? 0;

  void logUsage(supabase, {
    user_id: userId,
    provider: "openai",
    model: MODELS.prose,
    operation: "cellar-insight",
    units_in: tokensIn,
    units_out: tokensOut,
    cost_usd: estimateCost(MODELS.prose, tokensIn, tokensOut),
    metadata: { product_count: products.length },
  });

  const raw = completion.choices[0]?.message.content?.trim();
  if (!raw) throw new Error("Cellar insight generator returned no content");

  const parsed = parseInsightResponse(raw);
  return { ...parsed, generated_at: new Date().toISOString(), have_hash: haveHash };
}

function parseInsightResponse(raw: string): Pick<CellarInsight, "bourbons" | "cigars"> {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  return {
    bourbons: typeof parsed.bourbons === "string" ? stripEmphasis(parsed.bourbons) : null,
    cigars: typeof parsed.cigars === "string" ? stripEmphasis(parsed.cigars) : null,
  };
}

function stripEmphasis(input: string): string {
  let text = input.trim();
  text = text.replace(/^[*_]+/, "").replace(/[*_]+$/, "");
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("\u201c") && text.endsWith("\u201d"))
  ) {
    text = text.slice(1, -1);
  }
  return text.trim();
}

/**
 * Load or generate the cellar insight for a member.
 * Returns cached if the have-list hash matches; regenerates otherwise.
 */
export async function ensureCellarInsight(
  supabase: SupabaseClient,
  memberId: string,
): Promise<CellarInsight | null> {
  const [cached, products] = await Promise.all([
    loadCachedInsight(supabase, memberId),
    loadShelfProducts(supabase, memberId),
  ]);

  if (products.length === 0) return null;

  const currentHash = computeHaveHash(products.map((p) => p.product_id));

  if (cached && cached.have_hash === currentHash) return cached;

  try {
    const insight = await generateCellarInsight(products, supabase, memberId);

    await supabase.from("users").update({ cellar_insight: insight }).eq("id", memberId);

    return insight;
  } catch (err) {
    console.warn("[cellar-insight] generation failed:", err);
    return cached;
  }
}
