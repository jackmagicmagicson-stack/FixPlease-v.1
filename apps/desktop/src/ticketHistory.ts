import type { Ticket, TicketStatus } from "./types";

const HISTORY_KEY = "fixplease_ticket_history";
const MAX_ENTRIES = 50;

export interface TicketHistoryEntry {
  id: string;
  public_number: number;
  description: string;
  status: TicketStatus;
  row_label: string;
  desk_label: string;
  closed_at: string | null;
  updated_at: string;
}

export function getTicketHistory(): TicketHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TicketHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: TicketHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function upsertTicketHistory(ticket: Ticket) {
  const entry: TicketHistoryEntry = {
    id: ticket.id,
    public_number: ticket.public_number,
    description: ticket.description,
    status: ticket.status,
    row_label: ticket.row_label,
    desk_label: ticket.desk_label,
    closed_at: ticket.closed_at,
    updated_at: new Date().toISOString(),
  };
  const rest = getTicketHistory().filter((e) => e.id !== ticket.id);
  saveHistory([entry, ...rest]);
}

export function clearTicketHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function isActiveStatus(status: TicketStatus): boolean {
  return status !== "closed" && status !== "draft";
}

export function getActiveHistoryEntries(): TicketHistoryEntry[] {
  return getTicketHistory().filter((e) => isActiveStatus(e.status));
}

export function getClosedHistoryEntries(): TicketHistoryEntry[] {
  return getTicketHistory().filter((e) => e.status === "closed");
}

/** Заявка создана или отслеживается на этом компьютере. */
export function isKnownTicket(ticketId: string): boolean {
  return getTicketHistory().some((e) => e.id === ticketId);
}

/** Минимальный Ticket из локальной истории — для офлайн-отображения при сбое сети. */
export function historyEntryToTicket(entry: TicketHistoryEntry): Ticket {
  return {
    id: entry.id,
    public_number: entry.public_number,
    row_label: entry.row_label,
    desk_label: entry.desk_label,
    category_id: "",
    description: entry.description,
    status: entry.status,
    closure_type: null,
    closure_reason: null,
    assigned_admin_id: null,
    is_priority: false,
    is_escalated: false,
    created_at: entry.updated_at,
    submitted_at: null,
    first_response_at: null,
    resolved_at: null,
    closed_at: entry.closed_at,
  };
}
