export const TONIGHT_PATH = "/";
export const SHELF_PATH = "/shelf";
export const LOG_PATH = "/log";
export const CATALOG_PATH = "/catalog";
export const APP_HOME_PATH = "/you";
/** Alias — concierge home is `/`, not a separate cellar route. */
export const CELLAR_PATH = TONIGHT_PATH;
export const SETTINGS_PATH = "/settings";
export const SETTINGS_PREFERENCES_PATH = `${SETTINGS_PATH}#preferences`;
export const PERSONAL_TASTINGS_PATH = "/log?filter=tastings";
export const PERSONAL_PAIRINGS_PATH = "/log?filter=pairings";
export const PAIRINGS_INDEX_PATH = PERSONAL_PAIRINGS_PATH;

export function getOnboardingExitPath(exit: "capture" | "preferences" | "lounge"): string {
  switch (exit) {
    case "capture":
      return "/capture";
    case "preferences":
      return SETTINGS_PREFERENCES_PATH;
    case "lounge":
      return TONIGHT_PATH;
  }
}
