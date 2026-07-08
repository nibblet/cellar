import Link from "next/link";
import { CATALOG_PATH, LOG_PATH, SETTINGS_PATH, SHELF_PATH } from "@/lib/navigation/paths";
import { cn } from "@/lib/utils";

const BROWSE_LINKS = [
  { href: SHELF_PATH, label: "Your shelf" },
  { href: LOG_PATH, label: "Your log" },
  { href: CATALOG_PATH, label: "Browse catalog" },
  { href: SETTINGS_PATH, label: "Settings" },
] as const;

type TasteProfileHeroProps = {
  firstName: string;
  bottleCount: number;
  cigarCount: number;
  huntingCount: number;
  tastingsCount: number;
};

export function TasteProfileHero({
  firstName,
  bottleCount,
  cigarCount,
  huntingCount,
  tastingsCount,
}: TasteProfileHeroProps) {
  return (
    <section className="mb-6">
      <header className="mb-4">
        <h1 className="text-3xl">You</h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-foreground-subtle">
          {firstName}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border pb-4">
        <Stat label="Bottles" value={bottleCount} />
        <Stat label="Cigars" value={cigarCount} />
        <Stat label="Hunting" value={huntingCount} accent />
        <Stat label="Logged" value={tastingsCount} />
      </div>

      <nav aria-label="Browse" className="flex flex-wrap gap-2">
        {BROWSE_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex items-center rounded-full border border-border bg-surface px-3.5 py-2",
              "text-sm text-foreground-muted transition-colors hover:border-accent/35 hover:text-accent",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <p className="text-[12px] uppercase tracking-[0.2em] text-foreground-subtle">
      <span className={cn("mr-1.5 font-semibold", accent ? "text-[#d86f49]" : "text-accent")}>
        {value}
      </span>
      {label}
    </p>
  );
}
