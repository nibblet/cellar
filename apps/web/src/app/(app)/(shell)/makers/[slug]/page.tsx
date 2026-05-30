import { notFound, redirect } from "next/navigation";
import { CatalogCard } from "@/components/feed";
import { AppShell } from "@/components/layout/app-shell";
import { WinstonTastingNote } from "@/components/product";
import { Divider, Voice } from "@/components/primitives";
import { loadCatalogBrowse } from "@/lib/feed/catalog-queries";
import { signImagePaths } from "@/lib/feed/queries";
import { ensureMaker, resolveMakerIdentity } from "@/lib/makers/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MakerAdminActions } from "./maker-admin-actions";

type Params = Promise<{ slug: string }>;

export default async function MakerPage({ params }: { params: Params }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const identity = await resolveMakerIdentity(supabase, slug);
  if (!identity) notFound();

  const [{ data: profile }, maker] = await Promise.all([
    supabase.from("users").select("role").eq("id", auth.user.id).maybeSingle(),
    ensureMaker(supabase, identity.brand, identity.type, auth.user.id),
  ]);

  const isAdmin = profile?.role === "admin";

  const entries = await loadCatalogBrowse(supabase, maker.type, null, 200, {
    brand: maker.name,
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
          {maker.type === "cigar" ? "Cigar maker" : "Distillery"}
        </p>
        <h1 className="text-3xl mt-1">{maker.name}</h1>
        {maker.country ? (
          <p className="text-sm text-foreground-muted mt-1">{maker.country}</p>
        ) : null}
        {maker.website ? (
          <a
            href={maker.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground-muted hover:text-foreground mt-1 inline-block transition-colors"
          >
            {maker.website.replace(/^https?:\/\//, "")}
          </a>
        ) : null}
        {maker.house_style ? (
          <p className="text-[11px] uppercase tracking-widest text-moss-500 mt-2">
            {maker.house_style}
          </p>
        ) : null}
      </header>

      {maker.blurb ? (
        <>
          <Divider label="Winston's take" />
          <div className="mb-5">
            <WinstonTastingNote text={maker.blurb} />
          </div>
        </>
      ) : null}

      <Divider label="In the club's catalog" />

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
          slug={maker.slug}
          initialBlurb={maker.blurb}
          blurbSource={maker.blurb_source}
        />
      ) : null}
    </AppShell>
  );
}
