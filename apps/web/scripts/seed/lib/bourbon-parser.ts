import { buildSynonymIndex, matchChip, type WheelVector } from "@/lib/wheel";

/**
 * Raw row shape from BourbonData.csv.
 */
export type BourbonCsvRow = {
  Name: string;
  Price: string;
  Abv: string;
  Rating: string;
  Year_Made: string;
  Distillery: string;
  Mash_Bill: string;
  Flavor_Profile: string;
  "Aging Period": string;
};

export type ParsedBourbon = {
  name: string;
  brand: string | null;
  specs: {
    price_usd?: number;
    abv?: number;
    proof?: number;
    year_made?: number;
    mash_bill?: string;
    aging_period_years?: number;
  };
  rating: number | null;
  flavor_profile_raw: string[];
  wheel_vector: WheelVector;
  unmapped_descriptors: string[];
};

const synonymIndex = buildSynonymIndex("bourbon");

function num(input: string): number | undefined {
  const trimmed = input?.trim();
  if (!trimmed) return undefined;
  const v = Number(trimmed);
  return Number.isFinite(v) ? v : undefined;
}

function cleanBrand(distillery: string): string | null {
  // "Jack Daniel Distillery" → "Jack Daniel"; "Old Forester Distillery (Brown-Forman)" → "Old Forester"
  const trimmed = distillery.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/\s*\(.*?\)\s*$/, "")
    .replace(/\s+distillery$/i, "")
    .trim();
}

function parseFlavorProfile(input: string): { mapped: WheelVector; unmapped: string[] } {
  const mapped: WheelVector = {};
  const unmapped: string[] = [];

  if (!input?.trim()) return { mapped, unmapped };

  const descriptors = input.split(",").map((d) => d.trim()).filter(Boolean);
  for (const descriptor of descriptors) {
    const leafId = matchChip(synonymIndex, descriptor);
    if (leafId) {
      // Seed pass: every mentioned descriptor gets a moderate baseline of 3/5.
      // The enrichment script can later refine using full review prose.
      mapped[leafId] = Math.max(mapped[leafId] ?? 0, 3);
    } else {
      unmapped.push(descriptor);
    }
  }

  return { mapped, unmapped };
}

export function parseBourbonRow(row: BourbonCsvRow): ParsedBourbon | null {
  const name = row.Name?.trim();
  if (!name) return null;

  const abv = num(row.Abv);
  const { mapped, unmapped } = parseFlavorProfile(row.Flavor_Profile);

  return {
    name,
    brand: cleanBrand(row.Distillery ?? ""),
    specs: {
      price_usd: num(row.Price),
      abv,
      proof: abv !== undefined ? abv * 2 : undefined,
      year_made: num(row.Year_Made),
      mash_bill: row.Mash_Bill?.trim() && row.Mash_Bill !== "undisclosed"
        ? row.Mash_Bill.trim()
        : undefined,
      aging_period_years: num(row["Aging Period"]),
    },
    rating: num(row.Rating) ?? null,
    flavor_profile_raw: row.Flavor_Profile?.split(",").map((d) => d.trim()).filter(Boolean) ?? [],
    wheel_vector: mapped,
    unmapped_descriptors: unmapped,
  };
}
