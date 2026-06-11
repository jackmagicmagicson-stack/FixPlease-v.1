import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { isTauriApp } from "./platform";

const WINDOWS_SYSTEM_SEGMENTS = [
  "\\windows\\",
  "\\program files\\",
  "\\program files (x86)\\",
  "\\programdata\\",
  "\\system volume information\\",
  "\\$recycle.bin\\",
  "\\recovery\\",
  "\\boot\\",
  "\\system32\\",
  "\\syswow64\\",
];

const UNIX_SYSTEM_PREFIXES = [
  "/etc/",
  "/sys/",
  "/proc/",
  "/dev/",
  "/bin/",
  "/sbin/",
  "/usr/",
  "/system/",
  "/library/apple/",
];

function isBlockedSystemPath(filePath: string): string | null {
  const win = filePath.replace(/\//g, "\\").toLowerCase();
  for (const segment of WINDOWS_SYSTEM_SEGMENTS) {
    if (win.includes(segment)) {
      return "Сохранение в системные папки Windows запрещено. Выберите другую папку.";
    }
  }

  const unix = filePath.replace(/\\/g, "/").toLowerCase();
  for (const prefix of UNIX_SYSTEM_PREFIXES) {
    if (unix.startsWith(prefix) || unix.includes(`:${prefix}`)) {
      return "Сохранение в системные каталоги запрещено. Выберите другую папку.";
    }
  }

  return null;
}

function downloadInBrowser(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Сохраняет файл: в Tauri — через диалог «Сохранить как», в браузере — скачивание. */
export async function saveBlobAsFile(
  blob: Blob,
  defaultName: string,
  filters?: { name: string; extensions: string[] }[],
): Promise<{ saved: boolean; path?: string }> {
  if (isTauriApp()) {
    const path = await save({
      defaultPath: defaultName,
      filters: filters ?? [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (!path) return { saved: false };

    const blocked = isBlockedSystemPath(path);
    if (blocked) throw new Error(blocked);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    await writeFile(path, bytes);
    return { saved: true, path };
  }

  downloadInBrowser(blob, defaultName);
  return { saved: true };
}
