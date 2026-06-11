import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  applyInterfacePrefs,
  loadInterfacePrefs,
  saveInterfacePrefs,
  type BlockSize,
  type FontSize,
  type InterfacePrefs,
  type ThemeMode,
} from "../interfacePrefs";

interface InterfacePrefsContextValue {
  prefs: InterfacePrefs;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (fontSize: FontSize) => void;
  setBlockSize: (blockSize: BlockSize) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setEmployeeUxEnhanced: (enabled: boolean) => void;
  updatePrefs: (patch: Partial<InterfacePrefs>) => void;
}

const InterfacePrefsContext = createContext<InterfacePrefsContextValue | null>(null);

export function InterfacePrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<InterfacePrefs>(() => loadInterfacePrefs());

  const commit = useCallback((updater: InterfacePrefs | ((prev: InterfacePrefs) => InterfacePrefs)) => {
    setPrefs((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveInterfacePrefs(next);
      applyInterfacePrefs(next);
      return next;
    });
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => commit((p) => ({ ...p, theme })), [commit]);

  const setFontSize = useCallback(
    (fontSize: FontSize) => commit((p) => ({ ...p, fontSize })),
    [commit],
  );

  const setBlockSize = useCallback(
    (blockSize: BlockSize) => commit((p) => ({ ...p, blockSize })),
    [commit],
  );

  const setAnimationsEnabled = useCallback(
    (animationsEnabled: boolean) => commit((p) => ({ ...p, animationsEnabled })),
    [commit],
  );

  const setEmployeeUxEnhanced = useCallback(
    (employeeUxEnhanced: boolean) => commit((p) => ({ ...p, employeeUxEnhanced })),
    [commit],
  );

  const updatePrefs = useCallback(
    (patch: Partial<InterfacePrefs>) => commit((p) => ({ ...p, ...patch })),
    [commit],
  );

  const value = useMemo(
    () => ({
      prefs,
      setTheme,
      setFontSize,
      setBlockSize,
      setAnimationsEnabled,
      setEmployeeUxEnhanced,
      updatePrefs,
    }),
    [
      prefs,
      setTheme,
      setFontSize,
      setBlockSize,
      setAnimationsEnabled,
      setEmployeeUxEnhanced,
      updatePrefs,
    ],
  );

  return (
    <InterfacePrefsContext.Provider value={value}>{children}</InterfacePrefsContext.Provider>
  );
}

export function useInterfacePrefs() {
  const ctx = useContext(InterfacePrefsContext);
  if (!ctx) throw new Error("useInterfacePrefs must be used within InterfacePrefsProvider");
  return ctx;
}
