import { NCCCLogo } from "@/components/brand";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLoading() {
  return (
    <AppShell>
      <div
        className="flex flex-col items-center justify-center py-24 gap-4"
        role="status"
        aria-busy="true"
        aria-label="Loading"
      >
        <NCCCLogo size={80} decorative className="animate-pulse" />
        <p className="text-[11px] uppercase tracking-widest text-foreground-subtle">
          Opening the humidor
        </p>
      </div>
    </AppShell>
  );
}
