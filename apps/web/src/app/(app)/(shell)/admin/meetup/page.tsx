import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Divider } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MeetupForm } from "./meetup-form";

type EventRow = {
  id: string;
  name: string;
  date: string;
  notes: string | null;
};

export default async function AdminMeetupPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const today = new Date().toISOString().slice(0, 10);

  const { data: upcoming } = await supabase
    .from("events")
    .select("id, name, date, notes")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1);

  const existing = (upcoming as EventRow[] | null)?.[0] ?? null;

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Admin</p>
        <h1 className="text-3xl mt-1">Next Meetup</h1>
      </header>

      <Divider label={existing ? "Edit upcoming" : "Schedule one"} />

      <MeetupForm existing={existing} />
    </AppShell>
  );
}
