import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupVoice } from "@/lib/aggregation/group-voice";
import { generateWinstonProse } from "@/lib/openai/winston-prose";
import type { AdjacentProduct } from "@/lib/similarity/suggest-adjacent";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ProductType, WheelVector } from "@/lib/wheel";

export type CachedWinstonProse = {
  text: string;
  input_hash: string;
  generated_at: string;
};

type ProductData = {
  id: string;
  type: ProductType;
  name: string;
  brand: string | null;
  specs: Record<string, unknown>;
  wheel_vector: WheelVector | null;
};

/**
 * Hash the inputs that affect Winston's paragraph. When any of these change
 * (new tasting logged, specs updated, adjacent products shift), the hash
 * changes and the next page view triggers regeneration.
 */
export function computeInputHash(
  product: ProductData,
  groupVoice: GroupVoice,
  adjacent: AdjacentProduct[],
): string {
  const payload = JSON.stringify({
    specs: product.specs,
    wv: product.wheel_vector,
    mc: groupVoice.member_count,
    rc: groupVoice.recommend_count,
    takes: groupVoice.takes.map((t) => ({
      u: t.user_id,
      r: t.recommend,
      c: t.chips,
      n: t.note,
    })),
    adj: adjacent.map((a) => a.product_id),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/**
 * Load or generate Winston's tasting paragraph for a product.
 * Returns cached text when the input hash matches; regenerates otherwise.
 * Returns null on failure — the UI simply hides the section.
 */
export async function ensureWinstonProse(
  supabase: SupabaseClient,
  product: ProductData,
  groupVoice: GroupVoice,
  adjacent: AdjacentProduct[],
  userId: string | null,
): Promise<string | null> {
  const currentHash = computeInputHash(product, groupVoice, adjacent);

  const { data: row } = await supabase
    .from("products")
    .select("winston_prose")
    .eq("id", product.id)
    .maybeSingle();

  const cached = row?.winston_prose as CachedWinstonProse | null;

  if (cached && cached.input_hash === currentHash && cached.text) {
    return cached.text;
  }

  try {
    const text = await generateWinstonProse(
      {
        productId: product.id,
        productType: product.type,
        name: product.name,
        brand: product.brand,
        specs: product.specs,
        wheelVector: product.wheel_vector,
        groupVoice,
        adjacent,
      },
      supabase,
      userId,
    );

    const prose: CachedWinstonProse = {
      text,
      input_hash: currentHash,
      generated_at: new Date().toISOString(),
    };

    const admin = createSupabaseAdminClient();
    await admin
      .from("products")
      .update({ winston_prose: prose })
      .eq("id", product.id);

    return text;
  } catch (err) {
    console.warn("[winston-prose] generation failed:", err);
    return cached?.text ?? null;
  }
}
