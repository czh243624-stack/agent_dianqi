export type UiLanguage = "zh" | "en";

const LANGUAGE_STORAGE_KEY = "transformer-agent-ui-language";

export function readLanguagePreference(): UiLanguage {
  if (typeof window === "undefined") return "zh";
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "en" ? "en" : "zh";
}

export function saveLanguagePreference(language: UiLanguage) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}
