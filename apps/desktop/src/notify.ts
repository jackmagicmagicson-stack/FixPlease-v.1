import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import notificationSound from "./assets/sounds/tethys.mp3";
import { ticketStatusLabel } from "./statusLabels";
import { upsertTicketHistory } from "./ticketHistory";
import type { WsEvent, Ticket } from "./types";

let sound: HTMLAudioElement | null = null;

function inQuietHours(): boolean {
  const start = localStorage.getItem("quiet_start");
  const end = localStorage.getItem("quiet_end");
  if (!start || !end) return false;
  const now = new Date();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s <= e) return mins >= s && mins <= e;
  return mins >= s || mins <= e;
}

function playNotificationSound() {
  try {
    if (!sound) {
      sound = new Audio(notificationSound);
      sound.volume = 0.75;
    }
    sound.currentTime = 0;
    void sound.play().catch(() => {
      /* браузер/Tauri может заблокировать до первого клика пользователя */
    });
  } catch {
    /* ignore */
  }
}

function showInAppToast(title: string, body: string) {
  window.dispatchEvent(
    new CustomEvent("fixplease-toast", { detail: { message: `${title}: ${body}` } }),
  );
}

async function notify(title: string, body: string) {
  if (inQuietHours()) return;
  playNotificationSound();
  showInAppToast(title, body);
  let ok = await isPermissionGranted();
  if (!ok) {
    const p = await requestPermission();
    ok = p === "granted";
  }
  if (ok) {
    sendNotification({ title, body });
  }
}

export async function notifyWsEvent(event: WsEvent, isAdmin: boolean) {
  switch (event.type) {
    case "ticket_created":
      if (isAdmin) {
        await notify(
          "Новая заявка",
          `#${event.ticket.public_number} — ${event.ticket.row_label}, ${event.ticket.desk_label}`,
        );
      }
      break;
    case "ticket_updated":
      if (!isAdmin) {
        await notify(
          `Заявка #${event.ticket.public_number}`,
          `Статус: ${ticketStatusLabel(event.ticket)}`,
        );
      } else if (event.ticket.is_escalated) {
        await notify(
          "Эскалация",
          `Заявка #${event.ticket.public_number} ожидает слишком долго`,
        );
      }
      break;
    case "message_created":
      /* Чат обновляется в UI через WebSocket — без звука и без toast. */
      break;
    case "ticket_escalated":
      if (isAdmin) {
        await notify(
          "Эскалация",
          `Заявка #${event.public_number} не взята в работу`,
        );
      }
      break;
  }
}

export function saveLastTicket(ticket: Ticket) {
  localStorage.setItem("last_ticket_id", ticket.id);
  localStorage.setItem("last_ticket_number", String(ticket.public_number));
  upsertTicketHistory(ticket);
}

export function getLastTicketId() {
  return localStorage.getItem("last_ticket_id");
}

/** Разблокирует воспроизведение звука после первого взаимодействия пользователя. */
export function warmUpNotificationSound() {
  if (!sound) {
    sound = new Audio(notificationSound);
    sound.volume = 0.75;
  }
  sound.load();
}
