const STORAGE_KEY = "fixplease_autostart";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getAutostartPref(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) return true;
  return saved === "1";
}

export function setAutostartPref(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

export async function applyAutostart(enabled: boolean): Promise<void> {
  if (!isTauri()) return;
  const { disable, enable } = await import("@tauri-apps/plugin-autostart");
  if (enabled) {
    await enable();
  } else {
    await disable();
  }
}

/** Применяет сохранённую настройку к автозапуску ОС. */
export async function syncAutostartFromPref(): Promise<void> {
  await applyAutostart(getAutostartPref());
}

export async function readAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) return getAutostartPref();
  const { isEnabled } = await import("@tauri-apps/plugin-autostart");
  return isEnabled();
}
