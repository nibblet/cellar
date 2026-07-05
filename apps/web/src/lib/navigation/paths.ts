export const APP_HOME_PATH = "/you";
export const CELLAR_PATH = "/";
export const SETTINGS_PATH = "/settings";
export const SETTINGS_PREFERENCES_PATH = "/settings#preferences";
export const PERSONAL_TASTINGS_PATH = "/you/tastings";
export const PERSONAL_PAIRINGS_PATH = "/you/pairings";
export const PAIRINGS_INDEX_PATH = PERSONAL_PAIRINGS_PATH;

export function getOnboardingExitPath(exit: "capture" | "preferences" | "lounge"): string {
  switch (exit) {
    case "capture":
      return "/capture";
    case "preferences":
      return SETTINGS_PREFERENCES_PATH;
    case "lounge":
      return APP_HOME_PATH;
  }
}
