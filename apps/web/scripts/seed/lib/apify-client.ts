/**
 * Thin client for Apify's rag-web-browser actor.
 *
 * Uses the run-sync-get-dataset-items REST endpoint so we get clean
 * markdown back inline — no polling, no dataset bookkeeping.
 *
 * Docs: https://apify.com/apify/rag-web-browser/api
 */

const ACTOR = "apify~rag-web-browser";
const ENDPOINT = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`;

export type RagItem = {
  metadata?: { url?: string; title?: string };
  searchResult?: { url?: string; title?: string; description?: string };
  markdown?: string;
};

export type RagInput = {
  query: string;
  maxResults?: number;
  outputFormats?: Array<"markdown" | "text" | "html">;
};

export type ApifyClientOptions = {
  /** Memory (MB) to allocate per actor run. Default 2048 keeps us under the
   *  8GB free-tier cap so we can run sequentially without hitting 402s. */
  memoryMbytes?: number;
};

export class ApifyClient {
  private readonly memoryMbytes: number;

  constructor(
    private readonly token: string,
    opts: ApifyClientOptions = {},
  ) {
    if (!token) throw new Error("APIFY_TOKEN is required");
    this.memoryMbytes = opts.memoryMbytes ?? 2048;
  }

  async ragWebBrowser(input: RagInput): Promise<RagItem[]> {
    const body = {
      query: input.query,
      maxResults: input.maxResults ?? 3,
      outputFormats: input.outputFormats ?? ["markdown"],
    };
    const url = `${ENDPOINT}?token=${this.token}&memory=${this.memoryMbytes}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Apify ${res.status}: ${text.slice(0, 400)}`);
    }
    return (await res.json()) as RagItem[];
  }
}
