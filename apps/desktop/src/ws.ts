import TauriWebSocket from "@tauri-apps/plugin-websocket";
import { isAppVisible, onAppVisibilityChange } from "./appVisibility";
import type { WsEvent } from "./types";
import { wsUrl } from "./api";

type Handler = (event: WsEvent) => void;

let handlers: Handler[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let tauriSocket: TauriWebSocket | null = null;
let browserSocket: WebSocket | null = null;
let connectInFlight: Promise<void> | null = null;
let connected = false;
let paused = !isAppVisible();

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isWsConnected(): boolean {
  return connected;
}

function dispatchPoll() {
  window.dispatchEvent(new CustomEvent("fixplease-ws-poll"));
}

function updatePollFallback() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (handlers.length > 0 && !connected && !paused) {
    pollTimer = setInterval(dispatchPoll, 5000);
  }
}

function setConnected(next: boolean) {
  connected = next;
  updatePollFallback();
}

function scheduleReconnect() {
  if (paused) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    connectInFlight = null;
    void ensureConnected();
  }, 3000);
}

function handlePayload(raw: string) {
  try {
    const data = JSON.parse(raw) as WsEvent;
    handlers.forEach((h) => h(data));
  } catch (e) {
    console.error("ws parse", e);
  }
}

function teardownSockets() {
  tauriSocket?.disconnect().catch(() => {});
  tauriSocket = null;
  browserSocket?.close();
  browserSocket = null;
  connectInFlight = null;
  setConnected(false);
}

async function connectTauri(): Promise<void> {
  const ws = await TauriWebSocket.connect(wsUrl());
  tauriSocket = ws;
  setConnected(true);
  ws.addListener((msg) => {
    if (msg.type === "Text") {
      handlePayload(msg.data);
    }
    if (msg.type === "Close") {
      teardownSockets();
      scheduleReconnect();
    }
  });
}

function connectBrowser() {
  browserSocket = new WebSocket(wsUrl());
  browserSocket.onmessage = (ev) => handlePayload(ev.data as string);
  browserSocket.onopen = () => setConnected(true);
  browserSocket.onclose = () => {
    teardownSockets();
    scheduleReconnect();
  };
  browserSocket.onerror = () => browserSocket?.close();
}

async function ensureConnected() {
  if (paused || connected) return;
  if (connectInFlight) {
    await connectInFlight;
    return;
  }

  connectInFlight = (async () => {
    try {
      if (isTauri()) {
        await connectTauri();
      } else {
        connectBrowser();
      }
    } catch (e) {
      console.error("ws connect", e);
      teardownSockets();
      scheduleReconnect();
    }
  })();

  await connectInFlight;
}

if (typeof window !== "undefined") {
  window.addEventListener("fixplease-server-url-changed", () => {
    disconnectWs();
    if (handlers.length > 0 && !paused) {
      void ensureConnected();
    }
  });

  onAppVisibilityChange((visible) => {
    paused = !visible;
    if (paused) {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      teardownSockets();
      updatePollFallback();
      return;
    }
    if (handlers.length > 0) {
      void ensureConnected();
    }
  });
}

export function subscribe(handler: Handler) {
  handlers.push(handler);
  if (!paused) {
    void ensureConnected();
  }
  return () => {
    handlers = handlers.filter((h) => h !== handler);
    updatePollFallback();
  };
}

export function disconnectWs() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  teardownSockets();
  updatePollFallback();
}
