import Link from "next/link";
import { Divider, Voice } from "@/components/primitives";
import { todayKey } from "@/lib/daily-pour/select";
import { loadPickPourCandidates } from "@/lib/pick-pour/load";
import { selectPickPour } from "@/lib/pick-pour/select";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  type: string;
};

export async function TonightsPickSection({ memberId }: { memberId: string }) {
  const supabase = await createSupabaseServerClient();
  const candidates = await loadPickPourCandidates(supabase, memberId);
  const pick = selectPickPour({ memberId, date: todayKey(), rollIndex: 0 }, candidates);
  if (!pick) return null;

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, type")
    .in("id", [pick.cigar_id, pick.bourbon_id]);

  const rows = (products as ProductRow[] | null) ?? [];
  const cigar = rows.find((p) => p.type === "cigar");
  const bourbon = rows.find((p) => p.type === "bourbon");
  if (!cigar || !bourbon) return null;

  const cigarDisplay = cigar.brand ? `${cigar.brand} ${cigar.name}` : cigar.name;
  const bourbonDisplay = bourbon.brand ? `${bourbon.brand} ${bourbon.name}` : bourbon.name;
  const day = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  });
  const line = `"For a ${day} on the porch: ${cigarDisplay} with the ${bourbonDisplay}."`;

  return (
    <section className="mb-5">
      <Divider label="Tonight's pick" />
      <Voice className="block mb-2">{line}</Voice>
      <Link
        href={`/pairings/${pick.cigar_id}/${pick.bourbon_id}`}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[12px] transition-colors",
          "h-12 px-5 text-base",
          "bg-surface text-foreground-muted border border-border hover:bg-surface-2",
        )}
      >
        See the pairing →
      </Link>
    </section>
  );
}
