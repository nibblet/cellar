import { XMLParser } from "fast-xml-parser";

export type HalfwheelItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
};

const FEED_URL = "https://halfwheel.com/category/reviews/cigars/feed";

/**
 * Strip CDATA and HTML tags from RSS content fields.
 */
function clean(input: string | undefined): string {
  if (!input) return "";
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

/**
 * Fetch a single page of the Halfwheel cigar-reviews RSS feed.
 * page=1 is the most recent ~10 reviews; subsequent pages go back in time.
 */
export async function fetchHalfwheelPage(page: number): Promise<HalfwheelItem[]> {
  const url = page === 1 ? FEED_URL : `${FEED_URL}?paged=${page}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "NCCC-seed/0.1 (private cigar club app)",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });
  if (!res.ok) {
    throw new Error(`Halfwheel RSS page ${page} returned ${res.status}`);
  }

  const xml = await res.text();
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel;
  if (!channel) return [];

  const rawItems = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];

  type RawItem = {
    title?: string;
    link?: string;
    pubDate?: string;
    description?: string;
    "content:encoded"?: string;
  };

  return (rawItems as RawItem[]).map((r) => ({
    title: clean(r.title),
    link: r.link ?? "",
    pubDate: r.pubDate ?? "",
    description: clean(r.description),
    content: clean(r["content:encoded"]),
  }));
}

/**
 * Fetch up to `targetItems` Halfwheel review items by paging back through
 * the feed. Stops early if a page returns nothing (end of archive).
 *
 * Sleeps 500ms between pages to be polite — RSS isn't an API, and Halfwheel
 * is a small editorial site we're consuming as a hobbyist.
 */
export async function fetchHalfwheelReviews(
  targetItems: number,
  options: { maxPages?: number; sleepMs?: number } = {},
): Promise<HalfwheelItem[]> {
  const { maxPages = 100, sleepMs = 500 } = options;
  const seen = new Set<string>();
  const items: HalfwheelItem[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await fetchHalfwheelPage(page);
    if (batch.length === 0) break;

    for (const item of batch) {
      if (!item.link || seen.has(item.link)) continue;
      seen.add(item.link);
      items.push(item);
      if (items.length >= targetItems) break;
    }

    if (items.length >= targetItems) break;
    await new Promise((r) => setTimeout(r, sleepMs));
  }

  return items;
}
