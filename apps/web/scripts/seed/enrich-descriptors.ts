/**
 * One-time descriptor enrichment pass.
 *
 * For each product with attached product_reviews but a sparse wheel_vector,
 * call gpt-5-nano with the review text + the appropriate wheel and ask it to
 * extract a wheel_vector. Merge with the existing vector (max of each leaf).
 * Recompute trait_vector.
 *
 * Skip products that already have a richer wheel_vector than what enrichment
 * would produce (e.g., bourbons whose Flavor_Profile mapped cleanly).
 *
 * NOT IMPLEMENTED YET — requires OPENAI_API_KEY and a working OpenAI client
 * wrapper. Lands together with the LLM mapper in Phase 3.
 *
 * Run:  pnpm seed:enrich
 */

export {};

async function main() {
  console.log("[enrich-descriptors] not implemented — pairs with the LLM mapper in Phase 3.");
}

main().catch((err) => {
  console.error("[enrich-descriptors] failed:", err);
  process.exit(1);
});
