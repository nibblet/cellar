import { redirect } from "next/navigation";
import { CellarHomeClient } from "@/components/cellar/home-v2-client";
import { AppShell } from "@/components/layout/app-shell";
import { buildHomeV2Sections, deriveHomeV2Visibility, type ProductDetailsById } from "@/lib/cellar/home-v2";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { loadRecentPalateTraits } from "@/lib/cellar/palate-bar";
import { todayKey } from "@/lib/daily-pour/select";
import { loadFindNextSuggestions } from "@/lib/find-next/load";
import type { MemberNameFields } from "@/lib/identity";
import { hasAnyPreferences } from "@/lib/preferences/types";
import { ensurePairingProse } from "@/lib/pairing/prose-cache";
import { loadPickPourCandidates } from "@/lib/pick-pour/load";
import { selectPickPour } from "@/lib/pick-pour/select";
import { loadProductTypes, splitIdsByProductType } from "@/lib/products/split-by-type";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadMemberTasteContext } from "@/lib/taste/context";

export default async function CellarHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const memberId = auth.user.id;

  const [profileResult, tasteContext, tonightsPick] = await Promise.all([
    supabase
      .from("users")
      .select("name_first, name_last_initial")
      .eq("id", memberId)
      .maybeSingle(),
    loadMemberTasteContext(supabase, memberId),
    loadTonightsPick(supabase, memberId),
  ]);

  if (!profileResult.data) redirect("/login");
  const profile = profileResult.data as MemberNameFields;

  const [findNextSuggestions, haveTypeRows, palateTraits] = await Promise.all([
    loadFindNextSuggestions(supabase, memberId, tasteContext.preferences),
    loadProductTypes(supabase, tasteContext.snapshot.have),
    loadRecentPalateTraits(supabase, memberId),
  ]);

  const detailsById = await loadSuggestionProductDetails(supabase, findNextSuggestions);
  const sections = buildHomeV2Sections({
    suggestions: findNextSuggestions,
    detailsById,
    maxCatalogTier: tasteContext.preferences.max_catalog_tier,
  });

  const visibility = deriveHomeV2Visibility({
    haveCount: tasteContext.snapshot.have.size,
    hasPreferences: hasAnyPreferences(tasteContext.preferences),
    tryNextCount: sections.tryNext.bourbons.length + sections.tryNext.cigars.length,
    huntNextCount: sections.huntNext.length,
  });

  const { bourbons, cigars } = splitIdsByProductType(haveTypeRows);

  return (
    <AppShell>
      <CellarHomeClient
        headerMeta={buildHeaderMeta(profile.name_first)}
        bottleCount={bourbons.length}
        cigarCount={cigars.length}
        initialHuntingCount={tasteContext.snapshot.want.size}
        palateTraits={palateTraits}
        tonightsPick={tonightsPick}
        tryNext={sections.tryNext}
        initialHuntNext={sections.huntNext}
        visibility={visibility}
      />
    </AppShell>
  );
}

async function loadTonightsPick(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  memberId: string,
): Promise<{
  line: string;
  href: string;
  cigarName: string;
  bourbonName: string;
  cigarImageUrl: string | null;
  bourbonImageUrl: string | null;
  quote: string | null;
  noteNumber: string;
} | null> {
  const snapshot = await loadCellarSnapshot(supabase, memberId);
  if (snapshot.have.size === 0) return null;

  const candidates = await loadPickPourCandidates(supabase, memberId);
  const pick = selectPickPour({ memberId, date: todayKey(), rollIndex: 0 }, candidates);
  if (!pick) return null;

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, type, image_url")
    .in("id", [pick.cigar_id, pick.bourbon_id]);

  type ProductRow = {
    id: string;
    name: string;
    brand: string | null;
    type: string;
    image_url: string | null;
  };
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
  const prose = await ensurePairingProse(supabase, pick.cigar_id, pick.bourbon_id);
  return {
    line: `For a ${day} on the porch: ${cigarDisplay} with the ${bourbonDisplay}.`,
    href: `/pairings/${pick.cigar_id}/${pick.bourbon_id}`,
    cigarName: cigarDisplay,
    bourbonName: bourbonDisplay,
    cigarImageUrl: cigar.image_url,
    bourbonImageUrl: bourbon.image_url,
    quote: prose.notes,
    noteNumber: "No 01",
  };
}

async function loadSuggestionProductDetails(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  suggestions: Awaited<ReturnType<typeof loadFindNextSuggestions>>,
): Promise<ProductDetailsById> {
  const ids = [...suggestions.pour, ...suggestions.smoke].map((item) => item.product_id);
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return {};

  const { data } = await supabase.from("products").select("id, image_url, specs").in("id", uniqueIds);

  return Object.fromEntries(
    ((data ?? []) as Array<{ id: string; image_url: string | null; specs: Record<string, unknown> | null }>).map(
      (row) => [
        row.id,
        {
          product_id: row.id,
          image_url: row.image_url,
          tier:
            typeof row.specs?.tier === "number" &&
            row.specs.tier >= 1 &&
            row.specs.tier <= 5
              ? row.specs.tier
              : null,
        },
      ],
    ),
  );
}

function buildHeaderMeta(firstName: string): string {
  const now = new Date();
  const eastern = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    hour12: false,
    timeZone: "America/New_York",
  }).formatToParts(now);

  const weekday = eastern.find((part) => part.type === "weekday")?.value.toUpperCase() ?? "TODAY";
  const month = eastern.find((part) => part.type === "month")?.value.toUpperCase() ?? "";
  const day = eastern.find((part) => part.type === "day")?.value ?? "";
  const hourRaw = eastern.find((part) => part.type === "hour")?.value ?? "20";
  const hour = Number.parseInt(hourRaw, 10);

  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return `${weekday} • ${month} ${day} • ${greeting}, ${firstName.toUpperCase()}`;
}
