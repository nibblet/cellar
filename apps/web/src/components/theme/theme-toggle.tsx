"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ThemeMode = "light" | "dark" | "auto";
const STORAGE_KEY = "nccc-theme";

/**
 * Apply a theme choice to the document. Safe to call on either client
 * mount or in response to a user toggle.
 */
function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (mode === "light") root.classList.add("light");
  else if (mode === "dark") root.classList.add("dark");
  // 'auto' leaves both off and lets @media (prefers-color-scheme) decide.
}

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "auto") return v;
  return "auto";
}

/**
 * Tri-state theme toggle — Light / Dark / Auto. Stored to localStorage as
 * `nccc-theme` and applied immediately to the <html> element by removing
 * any prior `dark`/`light` class and adding the new one (or neither for
 * 'auto', which falls back to the OS preference).
 *
 * Pair this with the inline ThemeInitScript in the root layout to avoid
 * a flash-of-wrong-theme on first paint.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("auto");
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage on mount; don't trust SSR for the toggle
  // visual state.
  useEffect(() => {
    const stored = readStored();
    setMode(stored);
    setMounted(true);
  }, []);

  function select(next: ThemeMode) {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Privacy mode / quota — ignore; choice still applies for this session.
    }
    applyTheme(next);
  }

  const options: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "auto", label: "Auto", icon: Monitor },
  ];

  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset is for form controls; this is a stand-alone toggle group
    <div
      role="group"
      aria-label="Appearance"
      className="grid grid-cols-3 gap-2 p-1 bg-surface border border-border rounded-[12px]"
    >
      {options.map((opt) => {
        const active = mounted && mode === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => select(opt.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 h-10 rounded-[10px] text-sm transition-colors",
              active
                ? "bg-accent text-ink-900"
                : "bg-transparent text-foreground-muted hover:bg-surface-2",
            )}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Inline script for the root layout's <head>. Runs synchronously before the
 * body paints — reads localStorage and applies the right html class. Without
 * this, users who chose 'light' would briefly see dark mode on every nav.
 *
 * Renders as `dangerouslySetInnerHTML` on a server component; the script
 * itself runs on the client.
 */
export function ThemeInitScript() {
  const js = `(function(){try{var m=localStorage.getItem('${STORAGE_KEY}');var r=document.documentElement;r.classList.remove('light','dark');if(m==='light'){r.classList.add('light');}else if(m==='dark'){r.classList.add('dark');}else if(m===null||m==='auto'){/* leave both off */}}catch(e){r.classList.add('dark');}})();`;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: required for pre-paint theme application
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
