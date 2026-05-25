import { describe, expect, it } from "vitest";
import { needsOnboarding } from "./load";

describe("needsOnboarding", () => {
  it("returns true when onboarding_completed_at is null", () => {
    expect(needsOnboarding({ onboarding_completed_at: null })).toBe(true);
  });

  it("returns false when onboarding_completed_at is set", () => {
    expect(needsOnboarding({ onboarding_completed_at: "2026-05-25T00:00:00Z" })).toBe(false);
  });
});
