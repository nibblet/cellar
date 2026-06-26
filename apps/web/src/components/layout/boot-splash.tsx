"use client";

import { useEffect, useState } from "react";
import { NCCCLogo } from "@/components/brand";

export function BootSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setVisible(false));
    return () => window.cancelAnimationFrame(id);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-300 pointer-events-none"
      aria-hidden="true"
    >
      <NCCCLogo size={96} decorative />
      <p className="mt-4 text-[11px] uppercase tracking-widest text-foreground-subtle">
        Norton Commons Cigar Club
      </p>
    </div>
  );
}
