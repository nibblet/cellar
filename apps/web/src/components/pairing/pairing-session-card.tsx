import Link from "next/link";
import { Card } from "@/components/primitives";
import type { PairingSessionSummary } from "@/lib/pairing/sessions";
import { cn } from "@/lib/utils";

export function PairingSessionCard({ session }: { session: PairingSessionSummary }) {
  return (
    <Link href={`/pairings/${session.cigar_id}/${session.bourbon_id}`} className="block">
      <Card
        className={cn(
          "hover:bg-surface-2 transition-colors",
          session.both_recommended && "border-moss-600/40",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] uppercase tracking-widest text-foreground-subtle">
            {new Date(session.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          {session.both_recommended ? (
            <p className="text-[10px] uppercase tracking-widest text-moss-600">● recommended</p>
          ) : null}
        </div>
        <p className="text-base text-foreground mt-1 truncate">{session.cigar_name}</p>
        <p className="text-[11px] tracking-widest uppercase text-foreground-subtle my-1">with</p>
        <p className="text-base text-foreground truncate">{session.bourbon_name}</p>
        {session.pairing_note ? (
          <p className="text-sm text-foreground-muted italic mt-2 line-clamp-2">
            "{session.pairing_note}"
          </p>
        ) : null}
      </Card>
    </Link>
  );
}
