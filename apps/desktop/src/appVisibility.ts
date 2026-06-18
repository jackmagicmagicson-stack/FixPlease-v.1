import { listen } from "@tauri-apps/api/event";

type Listener = (visible: boolean) => void;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let visible =
  typeof document !== "undefined" ? document.visibilityState === "visible" : true;
const listeners = new Set<Listener>();

function emit() {
  window.dispatchEvent(
    new CustomEvent("fixplease-window-visibility", { detail: { visible } }),
  );
  listeners.forEach((fn) => fn(visible));
}

function setVisible(next: boolean) {
  if (visible === next) return;
  visible = next;
  emit();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    setVisible(document.visibilityState === "visible");
  });
}

if (isTauri()) {
  void listen<boolean>("fixplease-visibility", (event) => {
    setVisible(event.payload);
  });
}

export function isAppVisible(): boolean {
  return visible;
}

export function onAppVisibilityChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
