/**
 * PROTOTYPE / dry-run — not the production path. No DB touched.
 *
 * Applies the shared spine classifier (lib/spine-match.ts) to the whole local
 * BourbonData.csv: resolves every row to producer → brand_family → expression,
 * folds release variants, splits core vs long tail, and previews the cut-back
 * (which rows the production backfill would keep member-facing vs hide).
 *
 * Writes data/catalog-spine-report.txt and prints a summary + exemplars.
 *
 * Run:  pnpm tsx scripts/seed/prototype-catalog-spine.ts [brandFilterSubstring]
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExpressionStatus } from "./lib/brand-spine";
import { readCsv } from "./lib/csv";
import { classifyProduct, planCutback, type SpineInput } from "./lib/spine-match";

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

function restoreApostrophes(input: string): string {
  return input.replace(/([A-Za-z]s)  ([A-Z])/g, "$1' $2").replace(/([A-Za-z]) s\b/g, "$1's");
}
function num(s: string | undefined): number | null {
  const v = Number((s ?? "").trim());
  return Number.isFinite(v) ? v : null;
}

type Folded = { rawName: string; proof: number | null; price: number | null; mashBill: string | null; release: string | null; included: boolean };
type ExprGroup = { canonical: string; status: ExpressionStatus; spirit_type: string; rows: Folded[] };
type BrandGroup = { producer: string; brand_family: string; curated: boolean; expressions: Map<string, ExprGroup> };

async function main() {
  const filter = process.argv[2]?.toLowerCase();
  const rows = await readCsv<CsvRow>(CSV_PATH);

  // Classify + plan the cut-back over all rows.
  const items = rows
    .filter((r) => r.Name?.trim())
    .map((r) => {
      const name = restoreApostrophes(r.Name.trim());
      const input: SpineInput = {
        name,
        distillery: r.Distillery ?? "",
        specs: { mash_bill: r.Mash_Bill, age_years: num(r["Aging Period"]) ?? undefined },
        rating: num(r.Price), // CSV has no quality score we use; price stands in for survivor tiebreak
        enriched: Boolean(r.Flavor_Profile?.trim()),
        inCobb: false, // Cobb xlsx is gitignored / not present here; backfill reads it from DB specs
      };
      return { raw: r, name, input, fields: classifyProduct(input) };
    });
  const decisions = planCutback(items.map(({ input, fields }) => ({ input, fields })));

  const producers = new Map<string, Map<string, BrandGroup>>();
  let included = 0;
  items.forEach(({ raw, name, fields }, idx) => {
    const dec = decisions.get(idx);
    if (dec?.include) included++;
    const brands = producers.get(fields.producer) ?? new Map<string, BrandGroup>();
    producers.set(fields.producer, brands);
    const brand = brands.get(fields.brand_family) ?? { producer: fields.producer, brand_family: fields.brand_family, curated: fields.curated, expressions: new Map() };
    brands.set(fields.brand_family, brand);
    const expr = brand.expressions.get(fields.expression) ?? { canonical: fields.expression, status: fields.status, spirit_type: fields.spirit_type, rows: [] };
    brand.expressions.set(fields.expression, expr);
    const abv = num(raw.Abv);
    expr.rows.push({
      rawName: raw.Name.trim(),
      proof: abv != null ? Math.round(abv * 2 * 10) / 10 : null,
      price: num(raw.Price),
      mashBill: raw.Mash_Bill?.trim() && !/^undisclosed/i.test(raw.Mash_Bill.trim()) ? raw.Mash_Bill.trim() : null,
      release: fields.release_label,
      included: Boolean(dec?.include),
    });
    void name;
  });

  // ---- full report ------------------------------------------------------
  const out: string[] = [];
  const line = "─".repeat(76);
  let totalExpr = 0;
  let curatedBrands = 0;
  const brandRowCounts: Array<{ brand: string; rows: number; expr: number; kept: number }> = [];

  for (const [producer, brands] of [...producers.entries()].sort((a, b) => brandRows(b[1]) - brandRows(a[1]))) {
    out.push(`\n${line}\n${producer}\n${line}`);
    for (const brand of [...brands.values()].sort((a, b) => rowsIn(b) - rowsIn(a))) {
      const exprs = [...brand.expressions.values()];
      totalExpr += exprs.length;
      if (brand.curated) curatedBrands++;
      const kept = exprs.flatMap((e) => e.rows).filter((r) => r.included).length;
      brandRowCounts.push({ brand: `${producer} › ${brand.brand_family}`, rows: rowsIn(brand), expr: exprs.length, kept });
      out.push(`\n  ${brand.brand_family}  ${brand.curated ? "[curated]" : "[auto]"} — ${rowsIn(brand)} rows → ${exprs.length} expr, ${kept} kept`);
      for (const e of order(exprs)) renderExpr((s) => out.push(s ?? ""), e);
    }
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, out.join("\n"), "utf8");

  // ---- console summary --------------------------------------------------
  const totalBrands = brandRowCounts.length;
  console.log(`\n${line}\nCATALOG SPINE + CUT-BACK — dry run over local CSV (no DB)\n${line}`);
  console.log(`  rows in:            ${items.length}`);
  console.log(`  producers:          ${producers.size}`);
  console.log(`  brand families:     ${totalBrands}  (${curatedBrands} curated, ${totalBrands - curatedBrands} auto)`);
  console.log(`  expressions:        ${totalExpr}`);
  console.log(`  KEPT member-facing: ${included}  (curated core/limited survivors; Cobb adds on top in DB)`);
  console.log(`  HIDDEN (promotable):${items.length - included}`);
  console.log(`  full report:        data/catalog-spine-report.txt`);

  console.log(`\n  Curated brands — rows → expr (kept):`);
  for (const b of brandRowCounts.filter((b) => /Knob Creek|Maker's Mark|Buffalo Trace$|Weller|Four Roses|Wild Turkey$|1792|Eagle Rare|Blanton|Elijah Craig|Evan Williams|Larceny|Old Forester|Russell|Woodford/.test(b.brand)).sort((a, b) => b.rows - a.rows)) {
    console.log(`     ${String(b.rows).padStart(3)} → ${String(b.expr).padStart(2)} (${b.kept} kept)   ${b.brand}`);
  }
  console.log(`\n${line}\n`);
}

function renderExpr(W: (s?: string) => void, e: ExprGroup) {
  const proof = e.rows.map((r) => r.proof).find((p) => p != null) ?? null;
  const mash = e.rows.map((r) => r.mashBill).find(Boolean) ?? "undisclosed";
  const prices = e.rows.map((r) => r.price).filter((p): p is number => p != null);
  const releases = [...new Set(e.rows.map((r) => r.release).filter(Boolean))] as string[];
  const kept = e.rows.filter((r) => r.included).length;
  const priceStr = prices.length ? `$${Math.min(...prices)}${Math.max(...prices) !== Math.min(...prices) ? `–$${Math.max(...prices)}` : ""}` : "—";
  W(`      ${e.canonical} [${e.status.toUpperCase()}·${e.spirit_type}] ${proof ?? "?"}pf · ${priceStr} · mash ${mash} · ${kept}/${e.rows.length} kept`);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
