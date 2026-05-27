"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Divider } from "@/components/primitives";
import type { InclusionBrandGroup } from "@/lib/catalog/catalog-inclusion";
import { CatalogIncludedToggle } from "./catalog-included-toggle";

type CatalogInclusionClientProps = {
  groups: InclusionBrandGroup[];
  total: number;
};

/**
 * Admin manager for the member-facing catalog. Defaults to showing only the
 * likely duplicates (e.g. a Cobb row + bourbonExplorer row for the same bottle);
 * untick to browse the whole included catalog by brand. Tap a row to hide it.
 */
export function CatalogInclusionClient({ groups, total }: CatalogInclusionClientProps) {
  const [query, setQuery] = useState("");
  const [dupesOnly, setDupesOnly] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        rows: g.rows.filter((r) => {
          if (dupesOnly && !r.possibleDupe) return false;
          if (!q) return true;
          return (
            g.brand_family.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q) ||
            (r.expression ?? "").toLowerCase().includes(q)
          );
        }),
      }))
      .filter((g) => g.rows.length > 0);
  }, [groups, query, dupesOnly]);

  const shown = filtered.reduce((n, g) => n + g.rows.length, 0);
  const dupeTotal = groups.reduce((n, g) => n + g.dupeCount, 0);

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="In catalog" value={total} />
        <StatCard label="Possible dupes" value={dupeTotal} />
        <StatCard label="Shown" value={shown} />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brand or expression…"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-subtle"
        />
        <label className="flex items-center gap-2 text-sm text-foreground-muted shrink-0">
          <input
            type="checkbox"
            checked={dupesOnly}
            onChange={(e) => setDupesOnly(e.target.checked)}
          />
          Dupes only
        </label>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground-subtle">
            {dupesOnly
              ? "No possible duplicates — untick to browse the whole catalog."
              : "Nothing matches your search."}
          </p>
        </Card>
      ) : (
        filtered.map((group) => (
          <section key={group.brand_family} className="mb-4">
            <Divider label={group.brand_family} />
            <ul className="flex flex-col gap-2 mt-3">
              {group.rows.map((r) => (
                <li key={r.id}>
                  <Card className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${r.id}`}
                          className="block text-sm text-foreground hover:text-accent"
                        >
                          <span className="font-medium">{r.expression ?? r.name}</span>
                        </Link>
                        <p className="text-xs text-foreground-subtle mt-0.5 truncate">
                          {r.name}
                          {r.possibleDupe ? (
                            <span className="ml-2 text-amber-600/90 uppercase tracking-widest text-[10px]">
                              possible dupe
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <CatalogIncludedToggle productId={r.id} included={true} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="py-3 px-4 text-center">
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mt-1">{label}</p>
    </Card>
  );
}
