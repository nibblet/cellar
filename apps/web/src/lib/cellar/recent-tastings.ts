import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadRecentTastedProductIds(
  supabase: SupabaseClient,
  memberId: string,
  days = 14,
): Promise<Set<string>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from("tastings")
    .select("product_id")
    .eq("user_id", memberId)
    .gte("created_at", since.toISOString());

  return new Set(((data ?? []) as { product_id: string }[]).map((row) => row.product_id));
}

export function todaySeedDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
