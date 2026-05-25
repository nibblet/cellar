import Link from "next/link";
import { interactiveCardClassName, Voice } from "@/components/primitives";
import { cn } from "@/lib/utils";

export type PersonalCardThumb = {
  productId: string;
  name: string;
  imageUrl: string | null;
};

export function PersonalCard({
  title,
  counts,
  thumbs,
  href,
  emptyVoice,
}: {
  title: string;
  counts: string | null;
  thumbs: PersonalCardThumb[];
  href: string;
  emptyVoice: string;
}) {
  return (
    <Link href={href} className="block group">
      <div className={cn(interactiveCardClassName, "px-4 py-4")}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-base text-foreground">{title}</p>
          {counts ? (
            <p className="text-[11px] uppercase tracking-widest text-foreground-subtle">{counts}</p>
          ) : null}
        </div>
        {thumbs.length > 0 ? (
          <div className="mt-3 flex items-center gap-2">
            {thumbs.slice(0, 3).map((t) =>
              t.imageUrl ? (
                // biome-ignore lint/performance/noImgElement: signed/public URL, no loader needed
                <img
                  key={t.productId}
                  src={t.imageUrl}
                  alt={t.name}
                  className="w-12 h-12 rounded-lg object-contain bg-surface-2"
                />
              ) : (
                <div
                  key={t.productId}
                  className="w-12 h-12 rounded-lg bg-surface-2 flex items-center justify-center text-[10px] uppercase tracking-widest text-foreground-subtle"
                >
                  ?
                </div>
              ),
            )}
          </div>
        ) : (
          <Voice className="block mt-3 text-sm">{emptyVoice}</Voice>
        )}
      </div>
    </Link>
  );
}
