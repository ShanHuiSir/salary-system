const APP_RELOAD_PARAM = '__app_reload';
const APP_RELOAD_STORAGE_KEY = 'salary-app-update-reload-at';
const RELOAD_COOLDOWN_MS = 30_000;

const CHUNK_LOAD_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading chunk .+ failed/i,
  /ChunkLoadError/i,
];

function getErrorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ''}`;
  return String(error ?? '');
}

function getLastReloadAt(): number {
  try {
    return Number(sessionStorage.getItem(APP_RELOAD_STORAGE_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function setLastReloadAt(value: number) {
  try {
    sessionStorage.setItem(APP_RELOAD_STORAGE_KEY, String(value));
  } catch {
    // ignore storage failures; URL guard still prevents tight reload loops.
  }
}

export function isChunkLoadError(error: unknown): boolean {
  const errorText = getErrorText(error);
  return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => pattern.test(errorText));
}

export function reloadAppForUpdatedAssets(): boolean {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  const url = new URL(window.location.href);
  const urlReloadAt = Number(url.searchParams.get(APP_RELOAD_PARAM) ?? 0);
  const lastReloadAt = Math.max(urlReloadAt, getLastReloadAt());

  if (lastReloadAt > 0 && now - lastReloadAt < RELOAD_COOLDOWN_MS) {
    return false;
  }

  setLastReloadAt(now);
  url.searchParams.set(APP_RELOAD_PARAM, String(now));
  window.location.replace(url.toString());
  return true;
}

export function cleanupAppReloadParam() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(APP_RELOAD_PARAM)) return;

  url.searchParams.delete(APP_RELOAD_PARAM);
  window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
}
