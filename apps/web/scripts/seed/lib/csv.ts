import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

/**
 * Parse a CSV file into a typed array of records. Headers from the first row
 * become object keys; values stay as strings (caller coerces what it needs).
 */
export async function readCsv<T extends Record<string, string>>(path: string): Promise<T[]> {
  const text = await readFile(path, "utf8");
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as T[];
}
