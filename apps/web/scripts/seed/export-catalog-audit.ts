/**
 * Rebuild catalog-curation-audit.xlsx from live DB + tier review sheets.
 *
 * Tier 3/4/5 yellow edits live in catalog-curation-tier{N}-review.xlsx — they are
 * NOT auto-synced. This export merges them (non-empty cells only) on top of master.
 *
 *   pnpm export:catalog-audit
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "../..");
const OUT = path.resolve(__dirname, "../../../../data/catalog-curation-audit.xlsx");
const MASTER = path.resolve(__dirname, "../../../../data/catalog-curation-review.xlsx");

const args = [
  "exec",
  "tsx",
  "--env-file=.env.local",
  "scripts/seed/export-catalog-curation.ts",
  OUT,
  "--merge-from",
  MASTER,
  "--merge-all-tiers",
];

const result = spawnSync("pnpm", args, { cwd: WEB_ROOT, stdio: "inherit", env: process.env });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`[export:catalog-audit] done → ${OUT}`);
