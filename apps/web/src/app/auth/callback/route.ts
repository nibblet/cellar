import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PENDING_SIGNUP_COOKIE, type PendingSignup } from "@/app/(auth)/accept-invite/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  // If this was the post-invite leg of signup, finish creating the member.
  const cookieStore = await cookies();
  const pendingRaw = cookieStore.get(PENDING_SIGNUP_COOKIE)?.value;

  if (pendingRaw) {
    try {
      const pending: PendingSignup = JSON.parse(pendingRaw);
      const { data: userData } = await supabase.auth.getUser();

      if (userData.user) {
        // Idempotent: only insert the profile if it doesn't already exist.
        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from("users").insert({
            id: userData.user.id,
            name_first: pending.name_first,
            name_last_initial: pending.name_last_initial,
          });
          await supabase.rpc("consume_invite_token", { token_param: pending.token });
        }
      }
    } catch {
      // Malformed pending cookie — fall through; user can re-accept later.
    }

    cookieStore.delete(PENDING_SIGNUP_COOKIE);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
