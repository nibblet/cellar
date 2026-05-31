"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/wheel";

export type CatalogView = "products" | "makers";

type Props = {
  tab: "cigars" | "bourbons";
  activeView: CatalogView;
};

const BRANDS_VIEW_LABEL = "Brands";

function browseBrandsLabel(tab: "cigars" | "bourbons"): string {
  return tab === "cigars" ? "Browse cigar brands" : "Browse bourbon brands";
}

/**
 * Products vs houses toggle for Cigars / Bourbons catalog tabs.
 * State is `view=makers` in the URL; default is products.
 */
export function CatalogViewToggle({ tab, activeView }: Props) {
  const searchParams = useSearchParams();
  const productType: ProductType = tab === "cigars" ? "cigar" : "bourbon";
  const catalogAria =
    tab === "cigars" ? "Cigar catalog: products or brands" : "Bourbon catalog: products or brands";

  const baseParams = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    return params;
  };

  const productsHref = () => {
    const params = baseParams();
    params.delete("view");
    const q = params.toString();
    return q ? `/?${q}` : "/";
  };

  const brandsHref = () => {
    const params = baseParams();
    params.set("view", "brands");
    return `/?${params.toString()}`;
  };

  const fullIndexHref = `/makers?type=${productType}`;

  return (
    <div className="mb-4">
      <div
        role="tablist"
        aria-label={catalogAria}
        className="flex rounded-full border border-border bg-surface p-0.5"
      >
        <ViewTab href={productsHref()} active={activeView === "products"} label="Products" />
        <ViewTab href={brandsHref()} active={activeView === "makers"} label={BRANDS_VIEW_LABEL} />
      </div>

      <div className="flex justify-end mt-2 min-h-5">
        {activeView === "products" ? (
          <Link
            href={brandsHref()}
            className="text-xs text-foreground-muted hover:text-foreground transition-colors"
          >
            {browseBrandsLabel(tab)} →
          </Link>
        ) : (
          <Link
            href={fullIndexHref}
            className="text-xs text-foreground-muted hover:text-foreground transition-colors"
          >
            Full brand index →
          </Link>
        )}
      </div>
    </div>
  );
}

function ViewTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "flex-1 text-center text-xs uppercase tracking-widest py-2.5 min-h-11 rounded-full transition-colors",
        active
          ? "bg-surface-2 text-foreground shadow-sm"
          : "text-foreground-subtle hover:text-foreground-muted",
      )}
    >
      {label}
    </Link>
  );
}
