import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { ticketStatusLabel } from "./statusLabels";
import type { WsEvent, Ticket } from "./types";

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

async function notify(title: string, body: string) {
  if (inQuietHours()) return;
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
      await notify(
        "Новое сообщение",
        event.message.body.slice(0, 80),
      );
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
}

export function getLastTicketId() {
  return localStorage.getItem("last_ticket_id");
}

export function getLastTicketNumber() {
  return localStorage.getItem("last_ticket_number");
}
