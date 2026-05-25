import { AppShell } from "@/components/layout/app-shell";
import { Spinner } from "@/components/primitives";

export default function AppLoading() {
  return (
    <AppShell>
      <Spinner className="py-24" label="Loading" />
    </AppShell>
  );
}
