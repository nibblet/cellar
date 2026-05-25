export type OnboardingProfile = {
  name_first: string;
  onboarding_completed_at: string | null;
};

export type OnboardingExit = "capture" | "preferences" | "lounge";
