import Link from "next/link";
import { Button, Card, Chip, Divider, MemberTag, Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(data.user);

  return (
    <main className="mx-auto max-w-md px-5 py-10 flex-1">
      <header className="text-center mb-10">
        <h1 className="text-4xl mb-2">NCCC</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          Norton Commons Cigar Club
        </p>
      </header>

      <Voice className="text-center mb-10">
        “Welcome back. The humidor is open and the glass is poured.”
      </Voice>

      <div className="flex flex-col gap-3 mb-12">
        {isAuthenticated ? (
          <Link href="/capture">
            <Button size="large" className="w-full">
              Open the humidor
            </Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button size="large" className="w-full">
              Sign in
            </Button>
          </Link>
        )}
      </div>

      <Divider label="Design system check" />

      <Card className="mb-4">
        <p className="text-sm text-foreground-subtle mb-3">Member takes</p>
        <div className="flex flex-col gap-2">
          <MemberTag
            member={{ name_first: "Paul", name_last_initial: "C" }}
            recommendStatus="lit"
          />
          <MemberTag
            member={{ name_first: "Paul", name_last_initial: "B" }}
            recommendStatus="lit"
          />
          <MemberTag
            member={{ name_first: "Carl", name_last_initial: "B" }}
            recommendStatus="dim"
          />
        </div>
      </Card>

      <Card>
        <p className="text-sm text-foreground-subtle mb-3">Chips</p>
        <div className="flex flex-wrap gap-2">
          <Chip selected>cocoa</Chip>
          <Chip selected>leather</Chip>
          <Chip>pepper</Chip>
          <Chip>cedar</Chip>
        </div>
      </Card>
    </main>
  );
}
