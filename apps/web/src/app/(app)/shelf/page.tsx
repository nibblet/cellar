import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /shelf → /members/[me]?tab=cellar
 * Deep-link to the signed-in member's own Cellar tab.
 */
export default async function ShelfPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    redirect("/login");
  }

  redirect(`/members/${auth.user.id}?tab=cellar`);
}
