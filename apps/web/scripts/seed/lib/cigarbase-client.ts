/**
 * Client for the CigarBase RapidAPI endpoint:
 * https://rapidapi.com/<provider>/api/cigarbase
 *
 * Endpoint shape (from the marketplace listing):
 *   GET /cigars?limit=50&offset=0&brand=Cohiba
 *
 * Uses limit/offset pagination — different from cigar-api.com's page-based
 * pattern.
 */

const HOST = "cigarbase.p.rapidapi.com";
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

export async function cigarbaseGet(
  path: string,
  params: Record<string, string | number> = {},
): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `CigarBase ${path} → ${res.status} ${res.statusText} :: ${body.slice(0, 200)}`,
    );
  }
  return res.json();
}

/** List a page of cigars. Optional brand filter. */
export async function listCigars(
  limit: number,
  offset: number,
  brand?: string,
): Promise<unknown> {
  const params: Record<string, string | number> = { limit, offset };
  if (brand) params.brand = brand;
  return cigarbaseGet("/cigars", params);
}

export type CigarBaseRow = {
  id: string | null;
  name: string;
  brand: string | null;
  vitola: string | null;
  length: number | null;
  ring_gauge: number | null;
  country: string | null;
  strength: string | null;
  wrapper: string | null;
  binder: string | null;
  filler: string | null;
  image_url: string | null;
  description: string | null;
};

/**
 * Permissive normalizer — CigarBase's response shape isn't publicly
 * documented. We look for common field names and coerce types.
 */
export function normalizeCigar(raw: unknown): CigarBaseRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name) ?? str(r.cigar_name) ?? str(r.title) ?? null;
  if (!name) return null;
  return {
    id: str(r.id) ?? str(r._id) ?? str(r.cigar_id) ?? null,
    name,
    brand: str(r.brand) ?? str(r.brand_name) ?? str(r.manufacturer) ?? null,
    vitola: str(r.vitola) ?? str(r.shape) ?? str(r.size_name) ?? null,
    length: num(r.length) ?? num(r.length_in) ?? null,
    ring_gauge: num(r.ring_gauge) ?? num(r.gauge) ?? num(r.ring) ?? null,
    country: str(r.country) ?? str(r.origin) ?? str(r.country_of_origin) ?? null,
    strength: str(r.strength) ?? str(r.body) ?? null,
    wrapper: str(r.wrapper) ?? str(r.wrapper_color) ?? null,
    binder: str(r.binder) ?? null,
    filler: arrayStr(r.filler) ?? str(r.filler) ?? null,
    image_url: str(r.image) ?? str(r.image_url) ?? str(r.band_image) ?? null,
    description: str(r.description) ?? str(r.notes) ?? null,
  };
}

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
function arrayStr(v: unknown): string | null {
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  return null;
}
