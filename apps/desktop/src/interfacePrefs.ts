export type ThemeMode = "light" | "dark";
export type FontSize = "small" | "medium" | "large";
export type BlockSize = "compact" | "comfortable" | "spacious";

export interface InterfacePrefs {
  theme: ThemeMode;
  fontSize: FontSize;
  blockSize: BlockSize;
  /** Меньше анимаций, blur и фоновой отрисовки — для слабых ПК. */
  performanceMode: boolean;
  /** Новый UX сотрудника — можно отключить для отката к классике */
  employeeUxEnhanced: boolean;
}

const STORAGE_KEY = "fixplease_interface_prefs";

const DEFAULTS: InterfacePrefs = {
  theme: "light",
  fontSize: "medium",
  blockSize: "comfortable",
  performanceMode: true,
  employeeUxEnhanced: true,
};

function readPerformanceMode(parsed: Partial<InterfacePrefs> & { animationsEnabled?: boolean }): boolean {
  if (typeof parsed.performanceMode === "boolean") {
    return parsed.performanceMode;
  }
  if (typeof parsed.animationsEnabled === "boolean") {
    return !parsed.animationsEnabled;
  }
  return DEFAULTS.performanceMode;
}

export function loadInterfacePrefs(): InterfacePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<InterfacePrefs> & { animationsEnabled?: boolean };
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
      performanceMode: readPerformanceMode(parsed),
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
  root.dataset.performance = prefs.performanceMode ? "on" : "off";
  root.dataset.animations = prefs.performanceMode ? "off" : "on";
  root.dataset.employeeUx = prefs.employeeUxEnhanced ? "enhanced" : "classic";
}
