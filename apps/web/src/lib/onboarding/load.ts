import type { OnboardingProfile } from "./types";

export function needsOnboarding(
  profile: Pick<OnboardingProfile, "onboarding_completed_at">,
): boolean {
  return profile.onboarding_completed_at == null;
}
