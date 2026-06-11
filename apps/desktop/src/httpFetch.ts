import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

/** HTTPS in LAN often uses a self-signed cert; WebView fetch rejects it without this. */
function clientOptions(url: string) {
  const opts: {
    danger?: { acceptInvalidCerts: boolean; acceptInvalidHostnames: boolean };
    proxy?: {
      all: { url: string; noProxy: string };
    };
  } = {};

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") {
      opts.danger = {
        acceptInvalidCerts: true,
        acceptInvalidHostnames: true,
      };
    }
    if (isTauri() && isPrivateHost(parsed.hostname)) {
      opts.proxy = {
        all: {
          url: "http://127.0.0.1:9",
          noProxy: `${parsed.hostname},<local>,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,127.0.0.1,localhost`,
        },
      };
    }
  } catch {
    /* ignore */
  }

  return opts;
}

export async function appFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const opts = { ...init, ...clientOptions(input) };
  if (isTauri()) {
    return tauriFetch(input, opts);
  }
  return fetch(input, init);
}
