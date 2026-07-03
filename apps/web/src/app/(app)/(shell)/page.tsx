import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Winston } from "@/components/brand";
import {
  CellarInsightCard,
  CellarInsightSkeleton,
  TonightsPickSkeleton,
  TryNext,
  TryNextSkeleton,
} from "@/components/cellar";
import { AppShell } from "@/components/layout/app-shell";
import { CellarSection } from "@/components/members/sections";
import { Button, Divider, Voice } from "@/components/primitives";
import { ensureCellarInsight } from "@/lib/cellar/insight";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { todayKey } from "@/lib/daily-pour/select";
import { loadPickPourCandidates } from "@/lib/pick-pour/load";
import { selectPickPour } from "@/lib/pick-pour/select";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureTasteRecommendations } from "@/lib/taste";
import { cn } from "@/lib/utils";

export default async function CellarHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name_first")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) redirect("/login");

  return (
    <AppShell>
      <header className="mb-5">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          {profile.name_first}
        </p>
        <h1 className="text-3xl mt-1">Your humidor</h1>
      </header>

      <Suspense fallback={<TonightsPickSkeleton />}>
        <TonightsPickSection memberId={auth.user.id} />
      </Suspense>

      <Suspense fallback={<CellarInsightSkeleton />}>
        <CellarInsightSection memberId={auth.user.id} />
      </Suspense>

      <Suspense fallback={<TryNextSkeleton />}>
        <TryNextSection memberId={auth.user.id} />
      </Suspense>

      <Divider label="The shelf" />

      <Suspense fallback={null}>
        <ShelfSection memberId={auth.user.id} memberFirstName={profile.name_first} />
      </Suspense>
    </AppShell>
  );
}

async function ShelfSection({
  memberId,
  memberFirstName,
}: {
  memberId: string;
  memberFirstName: string;
}) {
  const supabase = await createSupabaseServerClient();
  const snapshot = await loadCellarSnapshot(supabase, memberId);
  if (snapshot.have.size === 0 && snapshot.want.size === 0 && snapshot.tried.size === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-4">
        <Winston variant="bust" size={88} className="rounded-full" />
        <Voice className="block">
          "The shelf is bare. Snap something the next time you light up."
        </Voice>
        <Link href="/capture" className="block w-full">
          <Button size="large" className="w-full">
            Open the humidor
          </Button>
        </Link>
      </div>
    );
  }
  return (
    <CellarSection memberId={memberId} memberFirstName={memberFirstName} isOwnProfile={true} />
  );
}

async function TonightsPickSection({ memberId }: { memberId: string }) {
  const supabase = await createSupabaseServerClient();
  const candidates = await loadPickPourCandidates(supabase, memberId);
  const pick = selectPickPour({ memberId, date: todayKey(), rollIndex: 0 }, candidates);
  if (!pick) return null;

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, type")
    .in("id", [pick.cigar_id, pick.bourbon_id]);

  type ProductRow = { id: string; name: string; brand: string | null; type: string };
  const rows = (products as ProductRow[] | null) ?? [];
  if (rows.length < 2) return null;

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

async function CellarInsightSection({ memberId }: { memberId: string }) {
  const supabase = await createSupabaseServerClient();
  const insight = await ensureCellarInsight(supabase, memberId);
  if (!insight) return null;
  return <CellarInsightCard insight={insight} />;
}

async function TryNextSection({ memberId }: { memberId: string }) {
  const supabase = await createSupabaseServerClient();
  const recommendations = await ensureTasteRecommendations(supabase, memberId);
  if (recommendations.cigars.length === 0 && recommendations.bourbons.length === 0) return null;
  return (
    <>
      <Divider label="Try next" />
      <TryNext cigars={recommendations.cigars} bourbons={recommendations.bourbons} />
    </>
  );
}
