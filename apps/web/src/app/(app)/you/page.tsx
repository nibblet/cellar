import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberBadges } from "@/components/members";
import { Card, Divider, Voice } from "@/components/primitives";
import type { BadgeComputeInput } from "@/lib/badges/compute";
import { badgesForMember, loadMemberBadges } from "@/lib/badges/load";
import { nextBadgeForMember } from "@/lib/badges/next";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { formatMemberInitials, type MemberNameFields } from "@/lib/identity";
import { countMemberPairingSessions, loadMemberPairingSessions } from "@/lib/pairing/sessions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PersonalCard, type PersonalCardThumb } from "./_components/personal-card";

export default async function YouHubPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const me = auth.user.id;

  const [
    profileResult,
    badgeMap,
    cellarSnapshot,
    recentTastingsResult,
    badgeInputs,
    tastingsCountResult,
    pairingsCount,
    recentPairings,
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id, name_first, name_last_initial, role, joined_at, avatar_url")
      .eq("id", me)
      .maybeSingle(),
    loadMemberBadges(supabase),
    loadCellarSnapshot(supabase, me),
    supabase
      .from("tastings")
      .select("id, product_id, product:products(id, name, image_url, type), created_at")
      .eq("user_id", me)
      .order("created_at", { ascending: false })
      .limit(3),
    buildBadgeInputs(supabase),
    supabase.from("tastings").select("id", { count: "exact", head: true }).eq("user_id", me),
    countMemberPairingSessions(supabase, me),
    loadMemberPairingSessions(supabase, me, 3),
  ]);

  if (!profileResult.data) redirect("/login");
  const profile = profileResult.data;
  const isAdmin = profile.role === "admin";
  const initials = formatMemberInitials(profile as MemberNameFields);

  let avatarSignedUrl: string | null = null;
  if (profile.avatar_url) {
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_url, 60 * 60);
    avatarSignedUrl = signed?.signedUrl ?? null;
  }

  const badges = badgesForMember(badgeMap, me);
  const nextBadge = nextBadgeForMember(badgeInputs, me);

  type TastingRow = {
    id: string;
    product_id: string;
    created_at: string;
    product: { id: string; name: string; image_url: string | null; type: string } | null;
  };
  const recentTastings = (recentTastingsResult.data as TastingRow[] | null) ?? [];
  const lastTasting = recentTastings[0] ?? null;
  const tastingThumbs: PersonalCardThumb[] = recentTastings
    .filter((t): t is TastingRow & { product: NonNullable<TastingRow["product"]> } =>
      Boolean(t.product),
    )
    .map((t) => ({
      productId: t.product.id,
      name: t.product.name,
      imageUrl: t.product.image_url,
    }));

  const haveIds = Array.from(cellarSnapshot.have).slice(0, 3);
  let cellarThumbs: PersonalCardThumb[] = [];
  if (haveIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, image_url")
      .in("id", haveIds);
    cellarThumbs = (
      (products ?? []) as { id: string; name: string; image_url: string | null }[]
    ).map((p) => ({ productId: p.id, name: p.name, imageUrl: p.image_url }));
  }

  const tastingsCount = tastingsCountResult.count ?? 0;
  const cellarCounts = `${cellarSnapshot.have.size} have · ${cellarSnapshot.want.size} want · ${cellarSnapshot.tried.size} tried`;
  const tastingsCountStr = `${tastingsCount} logged`;
  const pairingsCountStr = `${pairingsCount} captured`;
  const pairingThumbs: PersonalCardThumb[] = recentPairings.map((p) => ({
    productId: p.cigar_id,
    name: `${p.cigar_name} + ${p.bourbon_name}`,
    imageUrl: null,
  }));

  const lastVoice = lastTasting?.product
    ? lastTasting.product.type === "bourbon"
      ? `"You poured ${lastTasting.product.name} last."`
      : `"You lit ${lastTasting.product.name} last."`
    : null;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-tint to-accent/30 border border-accent/40 flex items-center justify-center overflow-hidden mb-3">
          {avatarSignedUrl ? (
            // biome-ignore lint/performance/noImgElement: signed URL
            <img src={avatarSignedUrl} alt={initials} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-3xl tracking-tight text-foreground">{initials}</span>
          )}
        </div>
        {profile.joined_at ? (
          <p className="text-sm text-foreground-muted mt-1">
            Member since{" "}
            {new Date(profile.joined_at).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
        ) : null}

        {badges.length > 0 || nextBadge ? (
          <div className="mt-5 flex items-start gap-4 justify-center flex-wrap">
            {badges.length > 0 ? <MemberBadges badges={badges} variant="hero" /> : null}
            {nextBadge ? (
              <span className="inline-flex flex-col items-center gap-1 w-16 opacity-50">
                <span className="inline-flex items-center justify-center rounded-full border border-dashed border-border bg-surface text-foreground-subtle font-medium tabular-nums min-w-[1.75rem] h-7 px-1.5 text-[11px] tracking-wide">
                  {nextBadge.badge.mark}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-foreground-subtle text-center leading-tight">
                  {nextBadge.badge.label}
                  <br />
                  {nextBadge.gap}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <Divider label="Personal" />

      {lastVoice ? <Voice className="block mb-4 text-sm">{lastVoice}</Voice> : null}

      <div className="flex flex-col gap-3">
        <PersonalCard
          title="Your cellar"
          counts={cellarCounts}
          thumbs={cellarThumbs}
          href="/you/cellar"
          emptyVoice='"The shelf is bare. Mark a few on hand."'
        />
        <PersonalCard
          title="Your tastings"
          counts={tastingsCountStr}
          thumbs={tastingThumbs}
          href="/you/tastings"
          emptyVoice='"Nothing logged yet, sir. Open the humidor."'
        />
        <PersonalCard
          title="Your pairings"
          counts={pairingsCountStr}
          thumbs={pairingThumbs}
          href="/you/pairings"
          emptyVoice='"No pairings captured yet. Pick a cigar and a pour."'
        />
      </div>

      <Divider label="The Club" />

      <Card className="mb-3">
        <Link
          href="/roadmap"
          className="block text-base text-foreground hover:text-foreground-muted"
        >
          Roadmap & Suggestions →
        </Link>
        <p className="text-sm text-foreground-subtle mt-1">
          See what's coming and send Paul a feature idea or bug report.
        </p>
      </Card>

      <Divider label="Account" />

      <Card className="mb-3">
        <Link
          href="/you/settings"
          className="block text-base text-foreground hover:text-foreground-muted"
        >
          Settings & preferences →
        </Link>
      </Card>

      {isAdmin ? (
        <Card className="mb-3">
          <Link
            href="/admin"
            className="block text-base text-foreground hover:text-foreground-muted"
          >
            Admin tools →
          </Link>
          <p className="text-sm text-foreground-subtle mt-1">Invites, suggestions, usage.</p>
        </Card>
      ) : null}
    </main>
  );
}

async function buildBadgeInputs(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<BadgeComputeInput> {
  const [membersResult, tastingsResult, eventsResult, winstonResult] = await Promise.all([
    supabase.from("users").select("id, joined_at"),
    supabase
      .from("tastings")
      .select("user_id, product_id, recommend, created_at, event_id, product:products(type)"),
    supabase.from("events").select("id, date, host_user_id"),
    supabase
      .from("pairings_cache")
      .select("cigar_id, bourbon_id")
      .not("rationale_text", "is", null),
  ]);

  type TastingQueryRow = {
    user_id: string;
    product_id: string;
    recommend: boolean;
    created_at: string;
    event_id: string | null;
    product: { type: "cigar" | "bourbon" } | null;
  };

  const tastings = ((tastingsResult.data as TastingQueryRow[] | null) ?? []).flatMap((row) => {
    const type = row.product?.type;
    if (type !== "cigar" && type !== "bourbon") return [];
    return [
      {
        user_id: row.user_id,
        product_id: row.product_id,
        product_type: type,
        recommend: row.recommend,
        created_at: row.created_at,
        event_id: row.event_id,
      },
    ];
  });

  return {
    members: (membersResult.data ?? []) as BadgeComputeInput["members"],
    tastings,
    events: (eventsResult.data ?? []) as BadgeComputeInput["events"],
    winstonPairs: (winstonResult.data ?? []) as BadgeComputeInput["winstonPairs"],
  };
}
