import Link from "next/link";
import { SETTINGS_PATH } from "@/lib/navigation/paths";
import { cn } from "@/lib/utils";

const HUB_LINKS = [
  { href: SETTINGS_PATH, label: "Settings" },
  { href: "#personal", label: "Personal" },
  { href: "#shelf", label: "Your Cellar" },
] as const;

export function YouHubHero({ firstName }: { firstName: string }) {
  return (
    <section className="mb-6">
      <header className="mb-4">
        <h1 className="text-3xl">You</h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-foreground-subtle">
          {firstName}
        </p>
      </header>

      <nav aria-label="You sections" className="flex flex-wrap gap-2">
        {HUB_LINKS.map((link) => (
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
