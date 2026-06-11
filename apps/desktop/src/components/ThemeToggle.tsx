import { Moon, Sun } from "lucide-react";
import { useInterfacePrefs } from "./InterfacePrefsProvider";

export function ThemeToggle() {
  const { prefs, setTheme } = useInterfacePrefs();
  const isDark = prefs.theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Тёмная тема" : "Светлая тема"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <span className="theme-toggle-track">
        <Sun size={13} strokeWidth={2.2} className="theme-toggle-icon theme-toggle-icon-sun" />
        <Moon size={13} strokeWidth={2.2} className="theme-toggle-icon theme-toggle-icon-moon" />
        <span className={`theme-toggle-thumb${isDark ? " is-dark" : ""}`} />
      </span>
    </button>
  );
}
