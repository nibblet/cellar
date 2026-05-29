import { PairingSessionCard } from "@/components/pairing/pairing-session-card";
import { Card, Voice } from "@/components/primitives";
import { loadMemberPairingSessions } from "@/lib/pairing/sessions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PairingsSection({ memberId }: { memberId: string }) {
  const supabase = await createSupabaseServerClient();
  const sessions = await loadMemberPairingSessions(supabase, memberId);

  if (sessions.length === 0) {
    return (
      <Card>
        <Voice className="block text-sm">
          "No pairings captured yet. Pick a cigar and a pour from the catalog."
        </Voice>
      </Card>
    );
  }

  const recommended = sessions.filter((s) => s.both_recommended).length;

  return (
    <>
      <p className="text-sm text-foreground-muted mb-4">
        {sessions.length} pairing{sessions.length === 1 ? "" : "s"}
        {recommended > 0 ? ` · ${recommended} fully recommended` : ""}
      </p>
      <div className="flex flex-col gap-3">
        {sessions.map((session) => (
          <PairingSessionCard key={session.id} session={session} />
        ))}
      </div>
    </>
  );
}
