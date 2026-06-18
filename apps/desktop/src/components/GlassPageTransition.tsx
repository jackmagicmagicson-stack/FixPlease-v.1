import type { ReactNode } from "react";
import { useInterfacePrefs } from "./InterfacePrefsProvider";

interface Props {
  pageKey: string;
  children: ReactNode;
}

export function GlassPageTransition({ pageKey, children }: Props) {
  const { prefs } = useInterfacePrefs();

  return (
    <div
      key={pageKey}
      className={`page-view${!prefs.performanceMode ? " page-fade-enter" : ""}`}
      data-page-key={pageKey}
    >
      {children}
    </div>
  );
}
