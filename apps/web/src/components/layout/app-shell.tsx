import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type AppShellProps = HTMLAttributes<HTMLElement> & {
  /** Auth flows — no bottom nav clearance. */
  auth?: boolean;
  /** Capture, welcome, session — extra vertical rhythm, still clears bottom nav. */
  spacious?: boolean;
};

/**
 * Shared page column for iPhone-first layout: 24px gutters, top safe area
 * for standalone PWA + black-translucent status bar, bottom clearance for nav.
 */
export function AppShell({
  auth = false,
  spacious = false,
  className,
  children,
  ...props
}: AppShellProps) {
  return (
    <main
      {...props}
      className={cn(
        "mx-auto max-w-md px-6 flex-1",
        spacious ? "nccc-safe-top-spacious" : "nccc-safe-top",
        auth ? "pb-10" : "pb-24",
        className,
      )}
    >
      {children}
    </main>
  );
}
