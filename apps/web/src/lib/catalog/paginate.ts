export const CATALOG_PAGE_SIZE = 36;

export type CatalogPageParams = {
  page: number;
  pageSize: number;
  offset: number;
};

export function parseCatalogPage(raw: Record<string, string | undefined>): CatalogPageParams {
  const pageSize = CATALOG_PAGE_SIZE;
  const parsed = Number.parseInt(String(raw.page ?? "1"), 10);
  const page = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  return { page, pageSize, offset: (page - 1) * pageSize };
}
