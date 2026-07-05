import { describe, expect, it } from "vitest";
import {
  APP_HOME_PATH,
  CELLAR_PATH,
  getOnboardingExitPath,
  PAIRINGS_INDEX_PATH,
  PERSONAL_PAIRINGS_PATH,
  PERSONAL_TASTINGS_PATH,
  SETTINGS_PATH,
  SETTINGS_PREFERENCES_PATH,
} from "./paths";

describe("navigation paths", () => {
  it("locks the canonical personal IA routes", () => {
    expect(APP_HOME_PATH).toBe("/you");
    expect(CELLAR_PATH).toBe("/");
    expect(SETTINGS_PATH).toBe("/settings");
    expect(SETTINGS_PREFERENCES_PATH).toBe("/settings#preferences");
    expect(PERSONAL_TASTINGS_PATH).toBe("/you/tastings");
    expect(PERSONAL_PAIRINGS_PATH).toBe("/you/pairings");
    expect(PAIRINGS_INDEX_PATH).toBe("/you/pairings");
  });

  it("maps onboarding exits to the new canonical destinations", () => {
    expect(getOnboardingExitPath("capture")).toBe("/capture");
    expect(getOnboardingExitPath("preferences")).toBe("/settings#preferences");
    expect(getOnboardingExitPath("lounge")).toBe("/you");
  });
});
