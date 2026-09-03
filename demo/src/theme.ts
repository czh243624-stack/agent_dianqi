export type WorkbenchTheme = "dark" | "light";

const THEME_KEY = "leeec.workbench.theme";
const THEME_EVENT = "leeec-theme";

export function readTheme(): WorkbenchTheme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: WorkbenchTheme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function setTheme(theme: WorkbenchTheme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
