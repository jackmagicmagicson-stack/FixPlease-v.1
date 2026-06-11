export type ThemeMode = "light" | "dark";
export type FontSize = "small" | "medium" | "large";
export type BlockSize = "compact" | "comfortable" | "spacious";

export interface InterfacePrefs {
  theme: ThemeMode;
  fontSize: FontSize;
  blockSize: BlockSize;
  animationsEnabled: boolean;
  /** Новый UX сотрудника — можно отключить для отката к классике */
  employeeUxEnhanced: boolean;
}

const STORAGE_KEY = "fixplease_interface_prefs";

const DEFAULTS: InterfacePrefs = {
  theme: "light",
  fontSize: "medium",
  blockSize: "comfortable",
  animationsEnabled: true,
  employeeUxEnhanced: true,
};

export function loadInterfacePrefs(): InterfacePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<InterfacePrefs>;
    return {
      theme: parsed.theme === "dark" ? "dark" : "light",
      fontSize:
        parsed.fontSize === "small" || parsed.fontSize === "large"
          ? parsed.fontSize
          : "medium",
      blockSize:
        parsed.blockSize === "compact" || parsed.blockSize === "spacious"
          ? parsed.blockSize
          : "comfortable",
      animationsEnabled: parsed.animationsEnabled !== false,
      employeeUxEnhanced: parsed.employeeUxEnhanced !== false,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveInterfacePrefs(prefs: InterfacePrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function applyInterfacePrefs(prefs: InterfacePrefs) {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.fontSize = prefs.fontSize;
  root.dataset.blockSize = prefs.blockSize;
  root.dataset.animations = prefs.animationsEnabled ? "on" : "off";
  root.dataset.employeeUx = prefs.employeeUxEnhanced ? "enhanced" : "classic";
}
