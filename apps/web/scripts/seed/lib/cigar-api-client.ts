/**
 * Client for cigar-api.com via RapidAPI (https://rapidapi.com/DaThresh/api/cigars).
 *
 * Returns plain JSON; we don't fully type the response because the actual
 * field set isn't documented publicly. The seeder uses a permissive mapper
 * to handle field variations.
 *
 * Requires RAPIDAPI_KEY in .env.local. The key in the user's RapidAPI
 * dashboard works for any subscribed marketplace API.
 */

const HOST = "cigars.p.rapidapi.com";
const BASE_URL = `https://${HOST}`;

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function headers() {
  return {
    "x-rapidapi-host": HOST,
    "x-rapidapi-key": required("RAPIDAPI_KEY", process.env.RAPIDAPI_KEY),
    "Content-Type": "application/json",
  };
}

/**
 * Fetch a single endpoint path with query params. Returns the parsed JSON
 * (any) so the caller can probe the shape on first run.
 */
export async function rapidGet(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RapidAPI ${path} → ${res.status} ${res.statusText} :: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * List cigars by page. Tries the conventional WordPress-style ?page=N first.
 * Many RapidAPI cigar databases use this pattern.
 */
export async function listCigars(page: number): Promise<unknown> {
  return rapidGet("/cigars", { page });
}

export async function getCigar(id: string | number): Promise<unknown> {
  return rapidGet(`/cigars/${id}`);
}

export async function listBrands(page: number): Promise<unknown> {
  return rapidGet("/brands", { page });
}

/**
 * Permissive field extraction — different cigar APIs name things differently.
 * Returns null when we can't even find a name field; the caller skips those.
 */
export type ApiCigarRow = {
  id: string | null;
  name: string;
  brand: string | null;
  length: number | null;
  ring_gauge: number | null;
  country: string | null;
  strength: string | null;
  wrapper: string | null;
  binder: string | null;
  filler: string | null;
  color: string | null;
  description: string | null;
};

export function normalizeCigar(raw: unknown): ApiCigarRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const name =
    str(r.name) ??
    str(r.cigar_name) ??
    str(r.title) ??
    null;
  if (!name) return null;

  return {
    id: str(r.id) ?? str(r._id) ?? str(r.cigar_id) ?? null,
    name,
    brand: str(r.brand) ?? str(r.brand_name) ?? str(r.manufacturer) ?? null,
    length: num(r.length) ?? num(r.length_in) ?? null,
    ring_gauge: num(r.ring_gauge) ?? num(r.gauge) ?? num(r.ring) ?? null,
    country: str(r.country) ?? str(r.origin) ?? str(r.country_of_origin) ?? null,
    strength: str(r.strength) ?? str(r.body) ?? null,
    wrapper: str(r.wrapper) ?? str(r.wrapper_color) ?? null,
    binder: str(r.binder) ?? null,
    filler: str(r.filler) ?? null,
    color: str(r.color) ?? str(r.wrapper_color) ?? null,
    description: str(r.description) ?? str(r.notes) ?? null,
  };
}

/**
 * Pull a list of cigar rows out of whatever shape the endpoint returned.
 * Supports: direct array, { data: [...] }, { results: [...] },
 * { cigars: [...] }, { items: [...] }.
 */
export function extractCigarArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    for (const key of ["data", "results", "cigars", "items", "rows"]) {
      const val = o[key];
      if (Array.isArray(val)) return val;
    }
  }
  return [];
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
