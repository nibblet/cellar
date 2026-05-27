/**
 * @deprecated Use `pnpm export:catalog-from-db` — writes a new dated file, never overwrites.
 *
 * This wrapper only re-exports the live DB (no tier merges, no audit.xlsx overwrite).
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const result = spawnSync(
  "pnpm",
  ["exec", "tsx", "--env-file=.env.local", "scripts/seed/export-catalog-curation.ts", "--fresh"],
  { cwd: WEB_ROOT, stdio: "inherit", env: process.env },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("[export:catalog-audit] done — see path printed above (dated export file)");
