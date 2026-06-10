import { invoke } from "@tauri-apps/api/core";
import { getServerUrl } from "./api";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function checkForUpdates(): Promise<string> {
  if (!isTauri()) {
    return "Обновления доступны только в установленном приложении Tauri.";
  }
  return invoke<string>("check_and_install_update", { serverUrl: getServerUrl() });
}
