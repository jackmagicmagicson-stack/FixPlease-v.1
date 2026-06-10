import type { WsEvent } from "./types";
import { wsUrl } from "./api";

type Handler = (event: WsEvent) => void;

let socket: WebSocket | null = null;
let handlers: Handler[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("fixplease-server-url-changed", () => {
    disconnectWs();
    if (handlers.length > 0) {
      ensureConnected();
    }
  });
}

export function subscribe(handler: Handler) {
  handlers.push(handler);
  ensureConnected();
  return () => {
    handlers = handlers.filter((h) => h !== handler);
  };
}

function ensureConnected() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  try {
    socket = new WebSocket(wsUrl());
    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as WsEvent;
        handlers.forEach((h) => h(data));
      } catch (e) {
        console.error("ws parse", e);
      }
    };
    socket.onclose = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(ensureConnected, 3000);
    };
    socket.onerror = () => socket?.close();
  } catch (e) {
    console.error("ws connect", e);
    reconnectTimer = setTimeout(ensureConnected, 5000);
  }
}

export function disconnectWs() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  socket?.close();
  socket = null;
}
