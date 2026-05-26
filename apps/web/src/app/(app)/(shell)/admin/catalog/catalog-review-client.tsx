"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Divider } from "@/components/primitives";
import { ReleaseVariantChips } from "@/components/product/release-variant-chips";
import type { CollapseGroup, SoloCollapseFlag } from "@/lib/catalog/collapse-groups";
import { cn } from "@/lib/utils";
import { CollapseFlagToggle } from "./collapse-flag-toggle";

type SkippedRow = {
  name: string;
  reason: string;
  productCount: number;
};

type CatalogReviewClientProps = {
  groups: CollapseGroup[];
  skipped: SkippedRow[];
  soloFlags: SoloCollapseFlag[];
  stats: {
    totalProducts: number;
    collapseFlagged: number;
    mergeVariants: number;
    expressionGroups: number;
  };
};

export function CatalogReviewClient({
  groups,
  skipped,
  soloFlags,
  stats,
}: CatalogReviewClientProps) {
  const [query, setQuery] = useState("");
  const [showSkipped, setShowSkipped] = useState(false);
  const [showSolo, setShowSolo] = useState(soloFlags.length > 0);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.expressionName.toLowerCase().includes(q) ||
        (g.brand ?? "").toLowerCase().includes(q) ||
        g.variants.some(
          (v) =>
            v.product.name.toLowerCase().includes(q) ||
            (v.releaseLabel ?? "").toLowerCase().includes(q),
        ),
    );
  }, [groups, query]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Bourbons" value={stats.totalProducts} />
        <StatCard label="Collapse flagged" value={stats.collapseFlagged} />
        <StatCard label="Merge groups" value={stats.expressionGroups} />
        <StatCard label="Variants to merge" value={stats.mergeVariants} />
      </div>

      <label className="block mb-6">
        <span className="sr-only">Search expressions</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brand or expression…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-subtle"
        />
      </label>

      <Divider label="Merge preview" />

      {filteredGroups.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground-subtle">
            {groups.length === 0
              ? "No merge groups — nothing flagged with two or more siblings."
              : "No groups match your search."}
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4 mt-4">
          {filteredGroups.map((group) => (
            <li key={group.expressionKey}>
              <CollapseGroupCard group={group} />
            </li>
          ))}
        </ul>
      )}

      {soloFlags.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setShowSolo((v) => !v)}
            className="mt-8 mb-3 text-sm text-foreground-muted hover:text-foreground"
          >
            {showSolo ? "Hide" : "Show"} solo collapse flags ({soloFlags.length})
          </button>
          {showSolo ? (
            <ul className="flex flex-col gap-2">
              {soloFlags.map(({ product, reason }) => (
                <li key={product.id}>
                  <Card className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <ProductLink id={product.id} name={product.name} brand={product.brand} />
                        <p className="text-xs text-foreground-subtle mt-1">{reason}</p>
                      </div>
                      <CollapseFlagToggle productId={product.id} specs={product.specs} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {skipped.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setShowSkipped((v) => !v)}
            className="mt-8 mb-3 text-sm text-foreground-muted hover:text-foreground"
          >
            {showSkipped ? "Hide" : "Show"} skipped groups ({skipped.length})
          </button>
          {showSkipped ? (
            <ul className="flex flex-col gap-2">
              {skipped.map((row) => (
                <li key={row.name}>
                  <Card className="py-3 px-4">
                    <p className="text-sm text-foreground">{row.name}</p>
                    <p className="text-xs text-foreground-subtle mt-1">
                      {row.reason} · {row.productCount} rows
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
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

function CollapseGroupCard({ group }: { group: CollapseGroup }) {
  const missingLabels = group.variants.filter((v) => !v.releaseLabel);

  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle">
          {group.brand ?? "Unknown brand"}
        </p>
        <h2 className="text-lg font-semibold text-foreground mt-0.5">{group.expressionName}</h2>
        <p className="text-xs text-foreground-muted mt-1">
          {group.variants.length + 1} rows today → 1 expression after merge
        </p>
      </div>

      <div className="px-4 py-3 bg-surface-2/40 border-b border-border">
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">
          After merge — release chips
        </p>
        <ReleaseVariantChips labels={group.previewLabels} releasePattern={group.releasePattern} />
        {group.previewLabels.length === 0 ? (
          <p className="text-xs text-foreground-subtle">No release labels inferred yet.</p>
        ) : null}
      </div>

      <ul className="divide-y divide-border">
        <li className="px-4 py-3">
          <CatalogProductRow
            product={group.survivor}
            badge={<RowBadge tone="survivor">Keeps</RowBadge>}
          />
        </li>
        {group.variants.map(({ product, releaseLabel }) => (
          <li key={product.id} className="px-4 py-3">
            <CatalogProductRow
              product={product}
              badge={
                <>
                  <RowBadge tone="variant">Merges</RowBadge>
                  {releaseLabel ? (
                    <span className="px-2 py-0.5 rounded-full bg-surface-2 text-xs text-foreground-muted border border-border">
                      {releaseLabel}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600/90">missing release label</span>
                  )}
                </>
              }
            />
          </li>
        ))}
      </ul>

      {missingLabels.length > 0 ? (
        <p className="px-4 py-2 text-xs text-amber-600/90 border-t border-border bg-amber-500/5">
          {missingLabels.length} variant{missingLabels.length === 1 ? "" : "s"} need a release label
          before merge.
        </p>
      ) : null}
    </Card>
  );
}

function RowBadge({ tone, children }: { tone: "survivor" | "variant"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded",
        tone === "survivor"
          ? "bg-moss-600/15 text-moss-600"
          : "bg-surface-2 text-foreground-subtle border border-border",
      )}
    >
      {children}
    </span>
  );
}

function CatalogProductRow({
  product,
  badge,
}: {
  product: CollapseGroup["survivor"];
  badge: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">{badge}</div>
        <ProductLink id={product.id} name={product.name} brand={product.brand} className="mt-2" />
      </div>
      <CollapseFlagToggle productId={product.id} specs={product.specs} />
    </div>
  );
}

function ProductLink({
  id,
  name,
  brand,
  className,
}: {
  id: string;
  name: string;
  brand: string | null;
  className?: string;
}) {
  return (
    <Link
      href={`/products/${id}`}
      className={cn("block text-sm text-foreground hover:text-accent", className)}
    >
      <span className="font-medium">{name}</span>
      {brand ? <span className="text-foreground-subtle"> · {brand}</span> : null}
    </Link>
  );
}
