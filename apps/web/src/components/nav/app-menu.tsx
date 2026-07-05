"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

import { SETTINGS_PATH } from "@/lib/navigation/paths";

const MENU_ITEMS = [
  { href: `${SETTINGS_PATH}#hero`, label: "Hero" },
  { href: `${SETTINGS_PATH}#name`, label: "Name" },
  { href: `${SETTINGS_PATH}#appearance`, label: "Appearance" },
  { href: `${SETTINGS_PATH}#preferences`, label: "Taste preferences" },
] as const;

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "fixed right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border transition-colors",
          "top-[max(1.5rem,env(safe-area-inset-top))]",
          "border-[color:rgba(212,168,98,0.14)] bg-[color:rgba(43,27,15,0.92)] text-foreground-subtle backdrop-blur",
          "hover:border-accent/35 hover:text-accent",
        )}
      >
        {open ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
      </button>

      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/45"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <nav
        id={menuId}
        aria-label="Settings"
        className={cn(
          "fixed right-6 z-50 w-[min(18rem,calc(100vw-3rem))] overflow-hidden rounded-[18px] border border-[rgba(184,137,88,0.18)] bg-[#17110d] shadow-[0_18px_48px_rgba(0,0,0,0.45)] transition-all",
          "top-[calc(max(1.5rem,env(safe-area-inset-top))+3.75rem)]",
          open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <div className="border-b border-[rgba(184,137,88,0.12)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-foreground-subtle">Settings</p>
        </div>
        <ul className="py-2">
          {MENU_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-base text-foreground transition-colors hover:bg-[rgba(255,214,125,0.06)] hover:text-[#f0cf95]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
