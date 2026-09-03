export type WorkbenchUser = {
  id: string;
  username: string;
  displayName: string;
  title: string;
  avatarText: string;
  avatarUrl?: string | null;
};

const SESSION_KEY = "leeec.workbench.user";
const SESSION_EVENT = "leeec-session";

export function readSession(): WorkbenchUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkbenchUser;
    if (!parsed?.id || !parsed.displayName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(user: WorkbenchUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function subscribeSession(onChange: () => void) {
  window.addEventListener(SESSION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SESSION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
