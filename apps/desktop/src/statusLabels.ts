import type { Ticket, TicketStatus } from "./types";

const STATUS_LABELS: Record<TicketStatus, string> = {
  draft: "Черновик",
  new: "Новая",
  in_progress: "В работе",
  resolved: "Решена",
  closed: "Закрыта",
};

/** Человекочитаемый статус заявки на русском. */
export function ticketStatusLabel(ticket: Pick<Ticket, "status" | "closure_type">): string {
  if (ticket.status === "closed") {
    if (ticket.closure_type === "rejected") return "Отклонена";
    if (ticket.closure_type === "forced") return "Закрыта принудительно";
  }
  return STATUS_LABELS[ticket.status] ?? ticket.status;
}

export function statusFilterLabel(status: TicketStatus): string {
  return STATUS_LABELS[status] ?? status;
}
