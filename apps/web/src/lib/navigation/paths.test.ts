import { describe, expect, it } from "vitest";
import {
  APP_HOME_PATH,
  CATALOG_PATH,
  CELLAR_PATH,
  getOnboardingExitPath,
  LOG_PATH,
  PAIRINGS_INDEX_PATH,
  PERSONAL_PAIRINGS_PATH,
  PERSONAL_TASTINGS_PATH,
  SETTINGS_PATH,
  SETTINGS_PREFERENCES_PATH,
  SHELF_PATH,
  TONIGHT_PATH,
} from "./paths";

describe("navigation paths", () => {
  it("locks Evening Model routes", () => {
    expect(TONIGHT_PATH).toBe("/");
    expect(SHELF_PATH).toBe("/shelf");
    expect(LOG_PATH).toBe("/log");
    expect(CATALOG_PATH).toBe("/catalog");
    expect(APP_HOME_PATH).toBe("/you");
    expect(CELLAR_PATH).toBe("/");
    expect(SETTINGS_PATH).toBe("/settings");
    expect(SETTINGS_PREFERENCES_PATH).toBe("/settings#preferences");
    expect(PERSONAL_TASTINGS_PATH).toBe("/log?filter=tastings");
    expect(PERSONAL_PAIRINGS_PATH).toBe("/log?filter=pairings");
    expect(PAIRINGS_INDEX_PATH).toBe("/log?filter=pairings");
  });

  it("maps onboarding exits to canonical destinations", () => {
    expect(getOnboardingExitPath("capture")).toBe("/capture");
    expect(getOnboardingExitPath("preferences")).toBe("/settings#preferences");
    expect(getOnboardingExitPath("lounge")).toBe("/");
  });
});
