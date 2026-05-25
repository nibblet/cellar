import Link from "next/link";
import { Winston } from "@/components/brand";
import { AppShell } from "@/components/layout/app-shell";
import { Divider, Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * First-run onboarding (Tier 3 #17). Reached after the auth callback
 * creates a brand-new public.users row — the callback redirects here
 * instead of `/`. Direct visits also work; the page is static.
 */
export default async function WelcomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("name_first")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle();

  const firstName = profile?.name_first ?? "friend";

  return (
    <AppShell spacious>
      <figure className="mb-6 flex flex-col items-center">
        <Winston
          variant="library"
          size={1024}
          className="w-full max-w-sm h-auto rounded-[16px] border border-border"
          decorative={false}
        />
        <figcaption className="sr-only">
          Winston, the resident narrator of the Norton Commons Cigar Club, pouring a dram in the
          library.
        </figcaption>
      </figure>

      <header className="text-center mb-4">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">A warm welcome</p>
        <h1 className="text-4xl mt-1">Meet Winston</h1>
      </header>

      <Voice className="text-center mb-8">
        &ldquo;A pleasure to have you, {firstName}. The shelves are stocked and the leather&apos;s
        warm. Step in.&rdquo;
      </Voice>

      <Divider label="How NCCC works" />

      <ul className="flex flex-col gap-4 mb-8 text-foreground-muted">
        <li>
          <p className="text-sm tracking-widest uppercase text-foreground-subtle mb-1">
            Snap and recommend
          </p>
          <p>
            Photograph a cigar band or bourbon label. One tap on <em>Recommend to NCCC</em> tells
            the club it&apos;s worth their time.
          </p>
        </li>
        <li>
          <p className="text-sm tracking-widest uppercase text-foreground-subtle mb-1">
            The club speaks for itself
          </p>
          <p>
            No stars, no scores. Every product shows what the members actually taste — in their own
            words.
          </p>
        </li>
        <li>
          <p className="text-sm tracking-widest uppercase text-foreground-subtle mb-1">
            Winston pairs to your taste
          </p>
          <p>
            Set your preferences in Settings whenever you&apos;re ready. Until then, Winston stays
            neutral.
          </p>
        </li>
      </ul>

      <Link
        href="/"
        className="inline-flex w-full items-center justify-center h-14 px-6 rounded-[12px] bg-accent text-ink-900 font-medium hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Step into the lounge
      </Link>
    </AppShell>
  );
}
