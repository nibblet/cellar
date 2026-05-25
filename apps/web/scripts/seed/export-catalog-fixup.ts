/**
 * Export pre-collapse fix-up sheet — brand conflicts + mixed collapse flags.
 *
 *   pnpm export:catalog-fixup
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../../../data/catalog-curation-fixup.xlsx");

const REVIEW_SOURCES = [
  path.resolve(__dirname, "../../../../data/catalog-curation-review.xlsx"),
  path.resolve(__dirname, "../../../../data/catalog-curation-tier3-review.xlsx"),
  path.resolve(__dirname, "../../../../data/catalog-curation-tier4-review.xlsx"),
  path.resolve(__dirname, "../../../../data/catalog-curation-tier5-review.xlsx"),
];
const AUDIT = path.resolve(__dirname, "../../../../data/catalog-curation-audit.xlsx");

type Row = {
  id: string;
  tier: string;
  name: string;
  brand: string;
  rb: string;
  re: string;
  rcn: string;
  rc: string;
  rrl: string;
  distillery: string;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildHeaderMap(ws: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => {
    map.set(String(cell.value ?? ""), col);
  });
  return map;
}

function cellVal(raw: ExcelJS.CellValue): unknown {
  if (raw && typeof raw === "object" && "result" in raw) {
    return (raw as { result: unknown }).result;
  }
  return raw;
}

function getCell(ws: ExcelJS.Worksheet, row: number, hmap: Map<string, number>, key: string): string {
  const col = hmap.get(key);
  if (!col) return "";
  const v = cellVal(ws.getRow(row).getCell(col).value);
  return v == null ? "" : String(v).trim();
}

async function loadReviewFlags(): Promise<
  Map<string, { rc: string; re: string; rrl: string; rb: string; rcn: string }>
> {
  const merged = new Map<string, { rc: string; re: string; rrl: string; rb: string; rcn: string }>();
  for (const file of REVIEW_SOURCES) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.getWorksheet("Curate");
    if (!ws) continue;
    const hmap = buildHeaderMap(ws);
    for (let r = 2; r <= ws.rowCount; r++) {
      const id = getCell(ws, r, hmap, "product_id");
      if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
      merged.set(id, {
        rc: getCell(ws, r, hmap, "REVIEW_collapse"),
        re: getCell(ws, r, hmap, "REVIEW_expression"),
        rrl: getCell(ws, r, hmap, "REVIEW_release_label"),
        rb: getCell(ws, r, hmap, "REVIEW_brand"),
        rcn: getCell(ws, r, hmap, "REVIEW_canonical_name"),
      });
    }
  }
  return merged;
}

async function loadAudit(reviews: Map<string, { rc: string; re: string; rrl: string; rb: string; rcn: string }>): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(AUDIT);
  const ws = wb.getWorksheet("Curate");
  if (!ws) throw new Error("Missing Curate sheet in audit file");
  const hmap = buildHeaderMap(ws);
  const rows: Row[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const id = getCell(ws, r, hmap, "product_id");
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
    const rev = reviews.get(id);
    rows.push({
      id,
      tier: getCell(ws, r, hmap, "tier"),
      name: getCell(ws, r, hmap, "name"),
      brand: getCell(ws, r, hmap, "brand"),
      rb: getCell(ws, r, hmap, "REVIEW_brand") || rev?.rb || "",
      re: rev?.re ?? getCell(ws, r, hmap, "REVIEW_expression"),
      rcn: getCell(ws, r, hmap, "REVIEW_canonical_name") || rev?.rcn || "",
      rc: rev?.rc ?? (getCell(ws, r, hmap, "REVIEW_collapse") || "N"),
      rrl: rev?.rrl ?? getCell(ws, r, hmap, "REVIEW_release_label"),
      distillery: getCell(ws, r, hmap, "distillery"),
    });
  }
  return rows;
}

function findBrandConflicts(rows: Row[]): Map<string, Row[]> {
  const byCanon = new Map<string, Row[]>();
  for (const r of rows) {
    const k = norm(r.rcn);
    if (!k) continue;
    if (!byCanon.has(k)) byCanon.set(k, []);
    byCanon.get(k)!.push(r);
  }
  const conflicts = new Map<string, Row[]>();
  for (const [canon, group] of byCanon) {
    const brands = new Set(group.map((r) => norm(r.rb)).filter(Boolean));
    if (brands.size > 1 && group.length > 1) conflicts.set(canon, group);
  }
  return conflicts;
}

function findMixedCollapse(rows: Row[]): Map<string, Row[]> {
  const byCanon = new Map<string, Row[]>();
  for (const r of rows) {
    const k = norm(r.rcn);
    if (!k) continue;
    if (!byCanon.has(k)) byCanon.set(k, []);
    byCanon.get(k)!.push(r);
  }
  const mixed = new Map<string, Row[]>();
  for (const [canon, group] of byCanon) {
    if (group.length < 2) continue;
    const flags = new Set(group.map((r) => r.rc || "N"));
    if (flags.size > 1) mixed.set(canon, group);
  }
  return mixed;
}

const HEADERS = [
  "issue_type",
  "issue_group",
  "group_size",
  "product_id",
  "tier",
  "distillery",
  "REVIEW_brand",
  "REVIEW_canonical_name",
  "REVIEW_expression",
  "REVIEW_release_label",
  "REVIEW_collapse",
  "name",
  "FIX_brand",
  "FIX_collapse",
  "FIX_notes",
];

async function main() {
  const reviews = await loadReviewFlags();
  const rows = await loadAudit(reviews);
  const brandConflicts = findBrandConflicts(rows);
  const mixedCollapse = findMixedCollapse(rows);

  const wb = new ExcelJS.Workbook();
  wb.creator = "NCCC";
  wb.created = new Date();

  const readme = wb.addWorksheet("README");
  const lines = [
    "Pre-collapse fix-up — edit FIX_* columns (yellow), then apply with pnpm apply:catalog-fixup",
    "",
    "Brand conflict — same REVIEW_canonical_name, different REVIEW_brand. Set FIX_brand to the winner.",
    "Mixed collapse — same canonical, some REVIEW_collapse Y/N. Set FIX_collapse to Y or N per row.",
    "",
    `Brand conflict groups: ${brandConflicts.size} (${[...brandConflicts.values()].reduce((s, g) => s + g.length, 0)} rows)`,
    `Mixed collapse groups: ${mixedCollapse.size} (${[...mixedCollapse.values()].reduce((s, g) => s + g.length, 0)} rows)`,
    "",
    `Generated: ${new Date().toISOString()} · catalog ${rows.length} products`,
  ];
  for (const line of lines) readme.addRow([line]);
  readme.getColumn(1).width = 100;

  const addSheet = (name: string, issueType: string, groups: Map<string, Row[]>) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(HEADERS);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8E0D4" },
    };

    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [, group] of sorted) {
      group.sort((a, b) => a.tier.localeCompare(b.tier) || a.name.localeCompare(b.name));
      for (const r of group) {
        ws.addRow([
          issueType,
          r.rcn,
          group.length,
          r.id,
          r.tier,
          r.distillery,
          r.rb,
          r.rcn,
          r.re,
          r.rrl,
          r.rc,
          r.name,
          "",
          "",
          "",
        ]);
      }
    }

    const fixStart = HEADERS.indexOf("FIX_brand") + 1;
    for (let c = fixStart; c <= HEADERS.length; c++) {
      ws.getColumn(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF3D6" },
      };
    }

    const widths: Record<string, number> = {
      issue_group: 36,
      product_id: 38,
      name: 48,
      REVIEW_canonical_name: 36,
      REVIEW_expression: 28,
      FIX_notes: 32,
    };
    for (const [i, h] of HEADERS.entries()) {
      ws.getColumn(i + 1).width = widths[h] ?? 14;
    }
  };

  addSheet("Brand conflicts", "brand_conflict", brandConflicts);
  addSheet("Mixed collapse", "mixed_collapse", mixedCollapse);

  const all = wb.addWorksheet("All fixups");
  all.addRow(HEADERS);
  all.getRow(1).font = { bold: true };
  for (const [issueType, groups] of [
    ["brand_conflict", brandConflicts] as const,
    ["mixed_collapse", mixedCollapse] as const,
  ]) {
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [, group] of sorted) {
      group.sort((a, b) => a.tier.localeCompare(b.tier) || a.name.localeCompare(b.name));
      for (const r of group) {
        all.addRow([
          issueType,
          r.rcn,
          group.length,
          r.id,
          r.tier,
          r.distillery,
          r.rb,
          r.rcn,
          r.re,
          r.rrl,
          r.rc,
          r.name,
          "",
          "",
          "",
        ]);
      }
    }
  }

  await wb.xlsx.writeFile(OUT);
  console.log(`[export-catalog-fixup] wrote ${OUT}`);
  console.log(
    `[export-catalog-fixup] brand conflicts: ${brandConflicts.size} groups, ${[...brandConflicts.values()].reduce((s, g) => s + g.length, 0)} rows`,
  );
  console.log(
    `[export-catalog-fixup] mixed collapse: ${mixedCollapse.size} groups, ${[...mixedCollapse.values()].reduce((s, g) => s + g.length, 0)} rows`,
  );
}

main().catch((err) => {
  console.error("[export-catalog-fixup] failed:", err);
  process.exit(1);
});
