import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import logo from "../assets/logo.png";

function isTauriApp() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function WindowTitleBar() {
  const tauri = isTauriApp();

  const minimize = () => {
    if (tauri) void getCurrentWindow().minimize();
  };

  const toggleMaximize = () => {
    if (tauri) void getCurrentWindow().toggleMaximize();
  };

  const close = () => {
    if (tauri) void getCurrentWindow().close();
  };

  return (
    <header className="window-titlebar">
      <div className="window-titlebar-drag" data-tauri-drag-region={tauri ? true : undefined}>
        <img src={logo} alt="" className="window-titlebar-icon" />
        <span className="window-titlebar-title">FixPlease</span>
      </div>
      {tauri && (
        <div className="window-titlebar-controls">
          <button
            type="button"
            className="window-control"
            aria-label="Свернуть"
            onClick={minimize}
          >
            <Minus size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="window-control"
            aria-label="Развернуть"
            onClick={toggleMaximize}
          >
            <Square size={12} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="window-control window-control-close"
            aria-label="Свернуть в трей"
            title="Свернуть в трей"
            onClick={close}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </header>
  );
}
