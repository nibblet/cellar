import ExcelJS from "exceljs";
import { classifyProduct } from "./spine-match";

/**
 * Resolve the set of brand families the club engages with from a Cobb
 * collection xlsx (the "Whiskey Collection" sheet). Used to open up the
 * catalog cut-back beyond the curated mainstream brands.
 *
 * Resolves each row through the same classifier the catalog uses, so the
 * returned brand_family names line up with the products table.
 */
export async function readCobbBrandFamilies(xlsxPath: string): Promise<Set<string>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet("Whiskey Collection") ?? wb.worksheets[0];
  const header = (ws.getRow(1).values as (string | undefined)[]) ?? [];
  const col: Record<string, number> = {};
  header.forEach((h, i) => {
    if (typeof h === "string") col[h.trim()] = i;
  });
  const get = (row: ExcelJS.Row, name: string) => {
    const i = col[name];
    return i ? String(row.getCell(i).value ?? "").trim() : "";
  };

  const families = new Set<string>();
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const distiller = get(row, "Distiller") || get(row, "Distillery");
    const brand = get(row, "Brand Name") || get(row, "Brand");
    const expression = get(row, "Expression / Detail");
    if (!distiller && !brand) return;
    const fields = classifyProduct({
      name: `${brand} ${expression}`.trim() || brand,
      distillery: distiller || brand,
    });
    families.add(fields.brand_family);
  });
  return families;
}
