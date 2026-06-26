"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Voice } from "@/components/primitives";

export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <Voice className="text-lg">"The spirits must be at another bar. Give it a moment."</Voice>
        <button
          type="button"
          onClick={reset}
          className="h-12 px-6 rounded-[12px] bg-surface border border-border text-base text-foreground hover:bg-surface-2 transition-colors"
        >
          Try again
        </button>
      </div>
    </AppShell>
  );
}
