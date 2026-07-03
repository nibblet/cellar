import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CatalogCard } from "@/components/feed";
import { AppShell } from "@/components/layout/app-shell";
import { Divider, Voice, VoiceProseSkeleton } from "@/components/primitives";
import { loadCatalogBrowse } from "@/lib/feed/catalog-queries";
import { signImagePaths } from "@/lib/feed/queries";
import { loadMakerBySlug, resolveMakerIdentity } from "@/lib/makers/load";
import { makerSlug } from "@/lib/makers/slug";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MakerAdminActions } from "./maker-admin-actions";
import { MakerBlurbSection } from "./maker-blurb-section";

type Params = Promise<{ slug: string }>;

export default async function MakerPage({ params }: { params: Params }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const identity = await resolveMakerIdentity(supabase, slug);
  if (!identity) notFound();

  const [{ data: profile }, makerRow] = await Promise.all([
    supabase.from("users").select("role").eq("id", auth.user.id).maybeSingle(),
    loadMakerBySlug(supabase, slug),
  ]);

  const isAdmin = profile?.role === "admin";
  const name = makerRow?.name ?? identity.brand;
  const type = makerRow?.type ?? identity.type;

  const entries = await loadCatalogBrowse(supabase, type, null, 200, {
    brand: name,
    sort: "az",
  });

  const signed = await signImagePaths(
    supabase,
    entries.map((e) => e.hero_image_path),
  );

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          {type === "cigar" ? "Cigar maker" : "Distillery"}
        </p>
        <h1 className="text-3xl mt-1">{name}</h1>
        {makerRow?.country ? (
          <p className="text-sm text-foreground-muted mt-1">{makerRow.country}</p>
        ) : null}
        {makerRow?.website ? (
          <a
            href={makerRow.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground-muted hover:text-foreground mt-1 inline-block transition-colors"
          >
            {makerRow.website.replace(/^https?:\/\//, "")}
          </a>
        ) : null}
        {makerRow?.house_style ? (
          <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mt-2">
            {makerRow.house_style}
          </p>
        ) : null}
      </header>

      <Suspense
        fallback={
          <>
            <Divider label="Winston's take" />
            <VoiceProseSkeleton className="mb-5 px-5 py-5" />
          </>
        }
      >
        <MakerBlurbSection brand={identity.brand} type={identity.type} userId={auth.user.id} />
      </Suspense>

      <Divider label="In the catalog" />

      {entries.length === 0 ? (
        <Voice className="block text-sm mt-4">
          "Nothing from this house in the club catalog yet — check back after the next capture."
        </Voice>
      ) : (
        <div className="flex flex-col gap-3 mt-4">
          {entries.map((entry) => (
            <CatalogCard
              key={entry.product_id}
              entry={entry}
              signedHero={
                entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null
              }
            />
          ))}
        </div>
      )}

      {isAdmin ? (
        <MakerAdminActions
          slug={makerRow?.slug ?? makerSlug(identity.brand)}
          initialBlurb={makerRow?.blurb ?? null}
          blurbSource={makerRow?.blurb_source ?? "ai"}
        />
      ) : null}
    </AppShell>
  );
}
