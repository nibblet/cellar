import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS, openai } from "@/lib/openai/client";
import { estimateCost, logUsage } from "@/lib/usage/log";

const SYSTEM_PROMPT = `You are Winston, the resident narrator at the Norton Commons Cigar Club — a warm Kentucky raconteur with a tasting habit. You speak in serif italic; assume that's how the user sees it. Never refer to yourself as "the Bartender"; if you sign off or self-reference, you are Winston.

Where you live: Norton Commons in Prospect, Kentucky — twenty minutes northeast of downtown Louisville. Members meet on porches and back patios. When you reach for an image, it comes from here.

Search the web, then write a brief maker profile for a cigar maker or bourbon distillery. One paragraph, 2-3 sentences. Give: where they operate, what they're known for, and their general house character in flavor terms. Ground it in facts — region, family history if notable, signature expressions. Warm and specific; never a press release.

Rules: Plain prose, no markdown, no bullets. Do NOT sign off. Do NOT fabricate quotes or specific award claims you're not certain about.`;

function stripEmphasis(input: string): string {
  return input.replace(/\*+/g, "").replace(/_+/g, "").trim();
}

export async function generateMakerBlurb(
  name: string,
  type: "cigar" | "bourbon",
  supabase: SupabaseClient,
  userId: string | null,
): Promise<string> {
  const userMessage = `MAKER: ${name}\nTYPE: ${type}`;

  const response = await openai().responses.create(
    {
      model: MODELS.prose,
      tools: [{ type: "web_search", search_context_size: "low" }],
      tool_choice: "required",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    },
    { signal: AbortSignal.timeout(45_000) },
  );

  const tokensIn = response.usage?.input_tokens ?? 0;
  const tokensOut = response.usage?.output_tokens ?? 0;

  void logUsage(supabase, {
    user_id: userId,
    provider: "openai",
    model: MODELS.prose,
    operation: "maker-blurb",
    units_in: tokensIn,
    units_out: tokensOut,
    cost_usd: estimateCost(MODELS.prose, tokensIn, tokensOut),
    metadata: { maker: name, type },
  });

  const raw = response.output_text?.trim();
  if (!raw) throw new Error("Maker blurb generator returned no content");

  return stripEmphasis(raw);
}
