export type LogFilter = "all" | "tastings" | "pairings";

export function parseLogFilter(raw: string | undefined): LogFilter {
  if (raw === "tastings" || raw === "pairings") return raw;
  return "all";
}
