/**
 * Heuristics for turning rag-web-browser markdown into structured enrichment.
 *
 * The actor returns whole-page markdown — nav, footers, comment threads, the
 * works. We do two cheap passes:
 *
 *  1. pickImage: walk the markdown image refs, drop nav/avatars/ads by URL
 *     shape and dimensions, prefer ones that mention the product slug.
 *  2. cleanReview: chop the article body out of the page chrome using common
 *     boundary markers ("Discover more", "Recent Articles", "Categories:").
 *
 * Good enough for a prototype. Phase-2 work hands the same markdown to
 * gpt-5-nano to extract scores, vitola, ABV, and a wheel_vector.
 */

import type { RagItem } from "./apify-client";

const IMAGE_RE = /!\[[^\]]*\]\((https?:\/\/[^)\s]+\.(?:jpe?g|png|webp))[^)]*\)/gi;

// Cut points that reliably mark the end of the article body on common cigar
// and bourbon review sites. First match wins.
const BODY_END_MARKERS = [
  "### Discover more from",
  "### Recent Articles",
  "## Recent Articles",
  "Categories:",
  "DMCA.com Protection Status",
  "Subscribe to get the latest posts",
  "Leave a Reply",
  "### Email Signup",
];

// Hosts that consistently deliver catalog-quality hero shots. A small score
// boost lets us prefer e.g. Cigar Aficionado over a mid-burn action shot from
// a reviewer blog when both surface for the same product. Not a filter —
// products only found on lower-tier hosts still get picked.
const PREMIUM_HOSTS = [
  // Cigar
  "mshanken.imgix.net", // Cigar Aficionado CDN — clean white-bg shots
  "cigaraficionado.com",
  "drewestate.com",
  "padroncigars.com",
  // Bourbon retail / specialist
  "totalwine.com",
  "masterofmalt.com",
  "klwines.com",
  "seelbachs.com",
  "breakingbourbon.com", // consistently good hero shots, webflow CDN
  "whiskyadvocate.com",
  // Bourbon manufacturer sites — cleanest bottle shots when they surface
  "buffalotracedistillery.com",
  "fourrosesbourbon.com",
  "heavenhilldistillery.com",
  "heavenhill.com",
  "oldforester.com",
  "wildturkeybourbon.com",
  "makersmark.com",
  "wlweller.com",
  "eaglerare.com",
  "blantonsbourbon.com",
  "woodfordreserve.com",
  "knobcreek.com",
  "jimbeam.com",
];

// URL fragments that almost always indicate junk (logos, social, ads).
const IMAGE_BLOCKLIST = [
  "logo",
  "avatar",
  "gravatar",
  "icon",
  "sidebar",
  "banner",
  "ads",
  "dmca",
  "subscribe",
  "facebook",
  "twitter",
  "instagram",
  "youtube",
];

export type ImageCandidate = {
  url: string;
  score: number;
  sourceUrl: string;
};

export type Enrichment = {
  imageUrl: string | null;
  imageSourceUrl: string | null; // page the image came from
  imageCandidates: ImageCandidate[]; // ranked, for audit/debugging
  reviews: Array<{
    source: string; // hostname
    sourceUrl: string;
    title: string | null;
    text: string;
  }>;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function isImageLikelyProduct(imgUrl: string, productSlug: string): number {
  const lower = imgUrl.toLowerCase();
  let score = 0;
  if (IMAGE_BLOCKLIST.some((b) => lower.includes(b))) return -1;
  // tiny dims via querystring (?w=49, ?s=42) — typically thumbnails/avatars
  if (/[?&](?:w|width|s|h|height)=([1-9]\d?)\b/.test(lower)) return -1;
  // tiny dims via path segment (wix-style /w_49,h_49/)
  if (/[/_](?:w|h)_([1-9]\d?)\b/.test(lower)) return -1;
  // brand or product token match (weighted heavily — strongest signal)
  for (const token of productSlug.split("-")) {
    if (token.length >= 4 && lower.includes(token)) score += 2;
  }
  // generic cigar/bourbon image filenames
  if (/(cigar|bourbon|whiskey|bottle)/.test(lower)) score += 1;
  // larger dims suggest hero image
  if (/[?&](?:w|width)=([4-9]\d{2,}|\d{4,})/.test(lower)) score += 1;
  if (/[/_](?:w|width)_([4-9]\d{2,}|\d{4,})/.test(lower)) score += 1;
  // premium host boost — strong enough to flip a tie, not enough to override
  // a clearly better product-slug match elsewhere
  if (PREMIUM_HOSTS.some((h) => lower.includes(h))) score += 3;
  return score;
}

function imageCandidatesFromItem(item: RagItem, productSlug: string): ImageCandidate[] {
  const md = item.markdown ?? "";
  const sourceUrl = item.metadata?.url ?? item.searchResult?.url ?? "";
  const out: ImageCandidate[] = [];
  const seen = new Set<string>();
  for (const m of md.matchAll(IMAGE_RE)) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    const score = isImageLikelyProduct(url, productSlug);
    if (score >= 0) out.push({ url, score, sourceUrl });
  }
  return out;
}

function cleanReviewText(markdown: string): string {
  let cut = markdown.length;
  for (const marker of BODY_END_MARKERS) {
    const idx = markdown.indexOf(marker);
    if (idx > 500 && idx < cut) cut = idx;
  }
  let body = markdown.slice(0, cut);

  // strip image lines — keep just prose
  body = body.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
  // collapse 3+ blank lines
  body = body.replace(/\n{3,}/g, "\n\n");
  // hard cap so we don't store novels — reviewers ramble
  if (body.length > 8000) body = `${body.slice(0, 8000)}\n\n[...truncated]`;
  return body.trim();
}

export function extractEnrichment(
  items: RagItem[],
  product: { name: string; brand?: string | null },
): Enrichment {
  const slug = slugify(`${product.brand ?? ""} ${product.name}`);
  const allCandidates: ImageCandidate[] = [];
  const reviews: Enrichment["reviews"] = [];

  for (const item of items) {
    const url = item.metadata?.url ?? item.searchResult?.url;
    const md = item.markdown;
    if (!url || !md) continue;

    allCandidates.push(...imageCandidatesFromItem(item, slug));

    reviews.push({
      source: hostname(url),
      sourceUrl: url,
      title: item.metadata?.title ?? item.searchResult?.title ?? null,
      text: cleanReviewText(md),
    });
  }

  // Pick highest-scoring image across all result items, not just the first.
  // Score 0 means nothing about the URL signaled "product photo" — no name
  // tokens, no premium host. Defer to the LLM fallback in those cases rather
  // than picking an arbitrary UI asset.
  allCandidates.sort((a, b) => b.score - a.score);
  const top = allCandidates[0];
  const confident = top && top.score > 0;

  return {
    imageUrl: confident ? top.url : null,
    imageSourceUrl: confident ? top.sourceUrl : null,
    imageCandidates: allCandidates.slice(0, 10),
    reviews,
  };
}
