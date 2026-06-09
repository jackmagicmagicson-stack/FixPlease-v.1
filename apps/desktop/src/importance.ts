import type { Ticket } from "./types";

export type TicketSortMode = "importance" | "newest" | "oldest";

/** 0 — критично, 3 — обычная */
export function importanceRank(ticket: Ticket): number {
  if (ticket.is_escalated && ticket.is_priority) return 0;
  if (ticket.is_escalated) return 1;
  if (ticket.is_priority) return 2;
  return 3;
}

export function importanceLabel(ticket: Ticket): string {
  switch (importanceRank(ticket)) {
    case 0:
      return "Критичная";
    case 1:
      return "Эскалация";
    case 2:
      return "Приоритет";
    default:
      return "Обычная";
  }
}

export function importanceClass(ticket: Ticket): string {
  switch (importanceRank(ticket)) {
    case 0:
      return "importance-critical";
    case 1:
      return "importance-escalated";
    case 2:
      return "importance-priority";
    default:
      return "importance-normal";
  }
}

export const SORT_OPTIONS: { value: TicketSortMode; label: string }[] = [
  { value: "importance", label: "По важности" },
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
];
