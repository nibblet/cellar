"use client";

import { BookOpen, Plus, Sparkles, User, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { Winston } from "@/components/brand";
import { Button, Divider, Voice } from "@/components/primitives";
import { completeOnboarding } from "@/lib/onboarding/complete";
import type { OnboardingExit } from "@/lib/onboarding/types";
import { cn } from "@/lib/utils";

type Props = { firstName: string };

const HOW_IT_WORKS = [
  {
    label: "Snap and recommend",
    body: (
      <>
        Photograph a cigar band or bourbon label. One tap on <em>Recommend to NCCC</em> adds your
        voice to the archive — optional flavor chips, no scores.
      </>
    ),
  },
  {
    label: "The club speaks",
    body: (
      <>
        Every product shows what members actually taste. Winston pairs cigars and bourbons; moss
        marks what the club has validated together.
      </>
    ),
  },
  {
    label: "Your shelf, your taste",
    body: (
      <>
        Track Have / Want / Tried in your Cellar. Set preferences in Settings when you&apos;re ready
        — until then, Winston stays neutral.
      </>
    ),
  },
] as const;

const NAV_MAP = [
  { icon: BookOpen, label: "Lounge", line: "Daily Pour, club tastings, and catalog shelves." },
  {
    icon: Plus,
    label: "Capture",
    line: "The center button — snap and recommend.",
    captureFab: true,
  },
  { icon: Users, label: "Members", line: "Roster and everyone's Cellar." },
  { icon: Sparkles, label: "Pairings", line: "Winston's matches; capture a pairing from here." },
  { icon: User, label: "You", line: "Settings, preferences, your Cellar and tastings." },
] as const;

export function WelcomeFlow({ firstName }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, startTransition] = useTransition();

  function finish(exit: OnboardingExit) {
    startTransition(() => {
      void completeOnboarding(exit);
    });
  }

  return (
    <div
      className={cn(
        "transition-opacity duration-400 ease-out",
        pending && "opacity-60 pointer-events-none",
      )}
    >
      <p className="text-center text-meta tracking-widest uppercase text-foreground-subtle mb-6">
        {step} of 3
      </p>

      {step === 1 && (
        <div key="step-1" className="opacity-100 transition-opacity duration-400 ease-out">
          <figure className="mb-6 flex flex-col items-center">
            <Winston
              variant="library"
              size={1024}
              className="w-full max-w-sm h-auto rounded-[16px] border border-border"
              decorative={false}
            />
            <figcaption className="sr-only">Winston pouring a dram in the club library.</figcaption>
          </figure>

          <header className="text-center mb-4">
            <p className="text-sm tracking-widest uppercase text-foreground-subtle">
              A warm welcome
            </p>
            <h1 className="text-4xl mt-1">Meet Winston</h1>
          </header>

          <Voice className="text-center mb-8">
            &ldquo;Glad you walked over, {firstName}. Gas lamps are on, chair&apos;s open on
            the porch. Come sit.&rdquo;
          </Voice>

          <Button type="button" size="large" className="w-full" onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div key="step-2" className="opacity-100 transition-opacity duration-400 ease-out">
          <figure className="mb-6 flex justify-center">
            <Winston variant="bust" size={256} className="w-28 h-auto" decorative={false} />
          </figure>

          <Divider label="How NCCC works" />

          <ul className="flex flex-col gap-4 mb-8 text-foreground-muted">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.label}>
                <p className="text-sm tracking-widest uppercase text-foreground-subtle mb-1">
                  {item.label}
                </p>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>

          <Button type="button" size="large" className="w-full" onClick={() => setStep(3)}>
            Continue
          </Button>
        </div>
      )}

      {step === 3 && (
        <div key="step-3" className="opacity-100 transition-opacity duration-400 ease-out">
          <Divider label="Your map" />

          <ul className="flex flex-col gap-3 mb-6">
            {NAV_MAP.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface",
                      "captureFab" in item && item.captureFab && "ring-2 ring-background",
                    )}
                  >
                    <Icon
                      className="h-4 w-4 text-foreground-muted"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-foreground-muted">{item.line}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <Voice className="text-center mb-6">
            &ldquo;Your night, {firstName}. Where do we start?&rdquo;
          </Voice>

          <Button
            type="button"
            size="large"
            className="w-full mb-3"
            onClick={() => finish("capture")}
          >
            Capture something
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="large"
            className="w-full mb-3"
            onClick={() => finish("preferences")}
          >
            Set my preferences
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="large"
            className="w-full"
            onClick={() => finish("lounge")}
          >
            Explore the lounge
          </Button>
        </div>
      )}
    </div>
  );
}
