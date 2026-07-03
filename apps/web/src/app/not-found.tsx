import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Voice } from "@/components/primitives";
import { APP_HOME_PATH } from "@/lib/navigation/paths";

export default function NotFound() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <Voice className="text-lg">"Nothing to see here. That bottle may have been moved."</Voice>
        <Link
          href={APP_HOME_PATH}
          className="h-12 px-6 rounded-[12px] bg-surface border border-border text-base text-foreground hover:bg-surface-2 transition-colors inline-flex items-center justify-center"
        >
          Back to You
        </Link>
      </div>
    </AppShell>
  );
}
