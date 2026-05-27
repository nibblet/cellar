/**
 * PROTOTYPE — not wired into the seed pipeline. No DB touched.
 *
 * Applies the "clean spine + matching" approach to the WHOLE bourbon catalog:
 * resolves every row to producer → brand_family → expression, folds release
 * variants / near-duplicates together, carries the enriched data forward, and
 * splits each brand's core range from its long tail.
 *
 * Writes a full report to data/catalog-spine-report.txt and prints a summary
 * plus a few exemplar brands to the console.
 *
 * Run:  pnpm tsx scripts/seed/prototype-catalog-spine.ts [brandFilterSubstring]
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CORE_RANGES,
  type CoreExpression,
  type ExpressionStatus,
  resolveBrandFamily,
} from "./lib/brand-spine";
import { readCsv } from "./lib/csv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "data", "BourbonData.csv");
const OUT_PATH = path.join(__dirname, "..", "..", "..", "..", "data", "catalog-spine-report.txt");

type CsvRow = {
  Name: string;
  Price: string;
  Abv: string;
  Distillery: string;
  Mash_Bill: string;
  Flavor_Profile: string;
  "Aging Period": string;
};

// Same apostrophe fix the seed parser uses (inlined to stay DB/wheel-free).
function restoreApostrophes(input: string): string {
  return input.replace(/([A-Za-z]s)  ([A-Z])/g, "$1' $2").replace(/([A-Za-z]) s\b/g, "$1's");
}

function stripProof(name: string): string {
  return name.replace(/,?\s*\(?\d+(\.\d+)?\s*%\)?\s*$/, "").trim();
}

/** Release identity (year / batch / pick) so vintage variants fold together. */
function releaseLabel(name: string): string | null {
  const batch = name.match(/batch\s*#?\s*([0-9a-z-]+)/i);
  if (batch) return `Batch ${batch[1].toUpperCase()}`;
  const pick = name.match(/no\.?\s*(\d{3,5})/i);
  if (pick) return `Pick No. ${pick[1]}`;
  const year = name.match(/\b(20\d{2}|19\d{2})\b/);
  if (year) return year[1];
  return null;
}

function num(s: string | undefined): number | null {
  const v = Number((s ?? "").trim());
  return Number.isFinite(v) ? v : null;
}

function cleanExpression(remainder: string): string {
  const r = remainder
    .replace(/kentucky straight bourbon( whiskey)?/gi, "")
    .replace(/\b(20\d{2}|19\d{2})\b/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/batch\s*#?\s*[0-9a-z-]+/gi, "")
    .replace(/no\.?\s*\d{3,5}/gi, "")
    .replace(/\b\d+(\.\d+)?\s*%/g, "")
    .replace(/[,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return r;
}

type Folded = {
  rawName: string;
  proof: number | null;
  price: number | null;
  mashBill: string | null;
  flavors: string[];
  release: string | null;
};

type ExprGroup = {
  canonical: string;
  status: ExpressionStatus;
  spirit_type: string;
  overlayProof?: number;
  rows: Folded[];
};

type BrandGroup = {
  producer: string;
  brand_family: string;
  curated: boolean;
  expressions: Map<string, ExprGroup>;
};

function classify(name: string, brandFamily: string): { canonical: string; status: ExpressionStatus; spirit_type: string; overlayProof?: number } {
  const overlay = CORE_RANGES[brandFamily];
  if (overlay) {
    const hit: CoreExpression | undefined = overlay.find((e) => e.pattern.test(name));
    if (hit) {
      return { canonical: `${brandFamily} ${hit.canonical}`.replace(`${brandFamily} ${brandFamily}`, brandFamily), status: hit.status, spirit_type: hit.spirit_type ?? "bourbon", overlayProof: hit.proof };
    }
  }
  // auto-derive
  const prefix = new RegExp(`^${brandFamily.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i");
  const remainder = cleanExpression(stripProof(name).replace(prefix, ""));
  const spirit = /\brye\b/i.test(name) ? "rye" : "bourbon";
  const canonical = remainder ? `${brandFamily} ${remainder}` : brandFamily;
  return { canonical, status: "uncurated", spirit_type: spirit };
}

async function main() {
  const filter = process.argv[2]?.toLowerCase();
  const rows = await readCsv<CsvRow>(CSV_PATH);

  const producers = new Map<string, Map<string, BrandGroup>>();

  for (const r of rows) {
    const name = restoreApostrophes(r.Name?.trim() ?? "");
    if (!name) continue;
    const proofName = stripProof(name);
    const { producer, brand_family } = resolveBrandFamily(proofName, r.Distillery ?? "");
    const cls = classify(proofName, brand_family);

    const brands = producers.get(producer) ?? new Map<string, BrandGroup>();
    producers.set(producer, brands);
    const brand = brands.get(brand_family) ?? {
      producer,
      brand_family,
      curated: Boolean(CORE_RANGES[brand_family]),
      expressions: new Map<string, ExprGroup>(),
    };
    brands.set(brand_family, brand);

    const expr = brand.expressions.get(cls.canonical) ?? {
      canonical: cls.canonical,
      status: cls.status,
      spirit_type: cls.spirit_type,
      overlayProof: cls.overlayProof,
      rows: [],
    };
    brand.expressions.set(cls.canonical, expr);

    const abv = num(r.Abv);
    expr.rows.push({
      rawName: r.Name.trim(),
      proof: abv != null ? Math.round(abv * 2 * 10) / 10 : null,
      price: num(r.Price),
      mashBill: r.Mash_Bill?.trim() && !/^undisclosed/i.test(r.Mash_Bill.trim()) ? r.Mash_Bill.trim() : null,
      flavors: (r.Flavor_Profile ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
      release: releaseLabel(name),
    });
  }

  // ---- render -----------------------------------------------------------
  const out: string[] = [];
  const line = "─".repeat(76);
  const W = (s = "") => out.push(s);

  let totalExpr = 0;
  let curatedBrands = 0;
  const brandRowCounts: Array<{ brand: string; rows: number; expr: number }> = [];

  const sortedProducers = [...producers.entries()].sort((a, b) => brandRows(b[1]) - brandRows(a[1]));
  for (const [producer, brands] of sortedProducers) {
    W(`\n${line}\n${producer}\n${line}`);
    const sortedBrands = [...brands.values()].sort((a, b) => rowsIn(b) - rowsIn(a));
    for (const brand of sortedBrands) {
      const exprs = [...brand.expressions.values()];
      totalExpr += exprs.length;
      if (brand.curated) curatedBrands++;
      brandRowCounts.push({ brand: `${producer} › ${brand.brand_family}`, rows: rowsIn(brand), expr: exprs.length });

      const core = exprs.filter((e) => e.status === "core" || e.status === "uncurated" || e.status === "limited");
      const tail = exprs.filter((e) => e.status === "discontinued");
      W(`\n  ${brand.brand_family}  ${brand.curated ? "[curated]" : "[auto]"}  — ${rowsIn(brand)} rows → ${exprs.length} expressions`);
      for (const e of order(core)) renderExpr(W, e);
      if (tail.length) {
        W(`    · long tail (collapsed out of core):`);
        for (const e of order(tail)) renderExpr(W, e, true);
      }
    }
  }

  const fullReport = out.join("\n");
  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, fullReport, "utf8");

  // ---- console: summary + exemplars ------------------------------------
  const totalRows = rows.length;
  const totalBrands = brandRowCounts.length;
  const totalProducers = producers.size;
  console.log(`\n${line}`);
  console.log(`CATALOG SPINE — full-catalog dry run (no DB changes)`);
  console.log(line);
  console.log(`  rows in:              ${totalRows}`);
  console.log(`  producers:            ${totalProducers}`);
  console.log(`  brand families:       ${totalBrands}  (${curatedBrands} curated, ${totalBrands - curatedBrands} auto-grouped)`);
  console.log(`  expressions out:      ${totalExpr}`);
  console.log(`  collapse:             ${totalRows} rows → ${totalExpr} expressions (${Math.round((1 - totalExpr / totalRows) * 100)}% fewer items)`);
  console.log(`  full report:          data/catalog-spine-report.txt`);

  console.log(`\n  Top 15 brand families by row count:`);
  for (const b of brandRowCounts.sort((a, b) => b.rows - a.rows).slice(0, 15)) {
    console.log(`     ${String(b.rows).padStart(3)} rows → ${String(b.expr).padStart(2)} expr   ${b.brand}`);
  }

  const exemplars = filter
    ? [...allBrands(producers)].filter((b) => b.brand_family.toLowerCase().includes(filter))
    : pickExemplars(producers, ["Knob Creek", "Maker's Mark", "Buffalo Trace", "Weller", "Four Roses", "Wild Turkey", "1792"]);
  console.log(`\n${line}\n  EXEMPLAR BRANDS (full detail for the rest is in the report file)\n${line}`);
  const buf: string[] = [];
  for (const brand of exemplars) {
    buf.push(`\n  ${brand.producer} › ${brand.brand_family}  ${brand.curated ? "[curated]" : "[auto]"}  — ${rowsIn(brand)} rows → ${brand.expressions.size} expressions`);
    const exprs = [...brand.expressions.values()];
    for (const e of order(exprs)) renderExpr((s) => buf.push(s ?? ""), e, e.status === "discontinued");
  }
  console.log(buf.join("\n"));
  console.log(`\n${line}\n`);
}

function renderExpr(W: (s?: string) => void, e: ExprGroup, tail = false) {
  const proof = e.overlayProof ?? e.rows.map((r) => r.proof).find((p) => p != null) ?? null;
  const mash = e.rows.map((r) => r.mashBill).find(Boolean) ?? "undisclosed";
  const prices = e.rows.map((r) => r.price).filter((p): p is number => p != null);
  const releases = [...new Set(e.rows.map((r) => r.release).filter(Boolean))] as string[];
  const tag = e.status.toUpperCase();
  const priceStr = prices.length ? `$${Math.min(...prices)}${Math.max(...prices) !== Math.min(...prices) ? `–$${Math.max(...prices)}` : ""}` : "—";
  W(`      ${tail ? "· " : ""}${e.canonical}  [${tag}·${e.spirit_type}]  ${proof ?? "?"}pf · ${priceStr} · mash ${mash}`);
  if (e.rows.length > 1 || releases.length) {
    W(`          folded ${e.rows.length} rows${releases.length ? ` · releases: ${releases.slice(0, 8).join(", ")}${releases.length > 8 ? "…" : ""}` : ""}`);
  }
}

function order(exprs: ExprGroup[]): ExprGroup[] {
  const rank: Record<string, number> = { core: 0, limited: 1, uncurated: 2, discontinued: 3 };
  return [...exprs].sort((a, b) => rank[a.status] - rank[b.status] || b.rows.length - a.rows.length);
}
function rowsIn(b: BrandGroup): number {
  return [...b.expressions.values()].reduce((n, e) => n + e.rows.length, 0);
}
function brandRows(brands: Map<string, BrandGroup>): number {
  return [...brands.values()].reduce((n, b) => n + rowsIn(b), 0);
}
function* allBrands(producers: Map<string, Map<string, BrandGroup>>): Generator<BrandGroup> {
  for (const brands of producers.values()) for (const b of brands.values()) yield b;
}
function pickExemplars(producers: Map<string, Map<string, BrandGroup>>, names: string[]): BrandGroup[] {
  const out: BrandGroup[] = [];
  for (const b of allBrands(producers)) if (names.includes(b.brand_family)) out.push(b);
  return out.sort((a, b) => names.indexOf(a.brand_family) - names.indexOf(b.brand_family));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
