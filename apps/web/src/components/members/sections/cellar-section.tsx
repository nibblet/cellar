import { CellarTab } from "@/components/cellar";
import { loadCellarProducts } from "@/lib/cellar/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function CellarSection({
  memberId,
  memberFirstName,
  isOwnProfile,
}: {
  memberId: string;
  memberFirstName: string;
  isOwnProfile: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const [have, want, tried] = await Promise.all([
    loadCellarProducts(supabase, memberId, "have"),
    loadCellarProducts(supabase, memberId, "want"),
    loadCellarProducts(supabase, memberId, "tried"),
  ]);

  return (
    <CellarTab
      have={have}
      want={want}
      tried={tried}
      isOwnProfile={isOwnProfile}
      memberFirstName={memberFirstName}
    />
  );
}
