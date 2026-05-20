import type { SupabaseClient } from "@supabase/supabase-js";

export type UsageLogEntry = {
  user_id?: string | null;
  provider: "openai" | "replicate" | "supabase";
  model: string;
  operation: string;
  units_in?: number;
  units_out?: number;
  cost_usd?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Fire-and-forget usage log write. Failures are swallowed and logged —
 * never block the user's request on a cost-tracking write.
 *
 * Caller passes a Supabase client they already have (server-side in a
 * request context) so RLS works.
 */
export async function logUsage(supabase: SupabaseClient, entry: UsageLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from("usage_logs").insert({
      provider: entry.provider,
      model: entry.model,
      operation: entry.operation,
      units_in: entry.units_in ?? null,
      units_out: entry.units_out ?? null,
      cost_usd: entry.cost_usd ?? null,
      metadata: entry.metadata ?? null,
      user_id: entry.user_id ?? null,
    });
    if (error) console.warn("[usage] log write failed:", error.message);
  } catch (err) {
    console.warn("[usage] log write threw:", err);
  }
}

/**
 * GPT-5 mini pricing (as of 2026-05-20). Cents per 1K tokens.
 * Update when pricing changes.
 */
export const PRICING = {
  "gpt-5-mini": { input: 0.00025, output: 0.002 }, // per 1K tokens
  "gpt-5-nano": { input: 0.00005, output: 0.0004 },
} as const;

export function estimateCost(model: keyof typeof PRICING, tokensIn: number, tokensOut: number) {
  const p = PRICING[model];
  return (tokensIn / 1000) * p.input + (tokensOut / 1000) * p.output;
}
