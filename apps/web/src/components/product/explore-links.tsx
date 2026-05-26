import { ArrowUpRight } from "lucide-react";
import { Divider } from "@/components/primitives";

type ExploreLinksProps = {
  brand: string | null;
  name: string;
};

function buildSearchQuery(brand: string | null, name: string): string {
  const raw = brand ? `${brand} ${name}` : name;
  return encodeURIComponent(raw);
}

const LINKS = [
  {
    label: "Check CigarPage for deals",
    buildUrl: (q: string) =>
      `https://www.cigarpage.com/catalogsearch/result/?q=${q}`,
  },
  {
    label: "Cigar Aficionado ratings",
    buildUrl: (q: string) =>
      `https://www.cigaraficionado.com/ratings/search?q=${q}`,
  },
] as const;

export function ExploreLinks({ brand, name }: ExploreLinksProps) {
  const q = buildSearchQuery(brand, name);

  return (
    <div className="mt-8">
      <Divider label="Explore" />
      <div className="mt-3 flex flex-col gap-3">
        {LINKS.map((link) => (
          <a
            key={link.label}
            href={link.buildUrl(q)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            <span>{link.label}</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}
