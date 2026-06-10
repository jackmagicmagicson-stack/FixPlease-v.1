import { MapPin } from "lucide-react";
import {
  importanceClass,
  importanceLabel,
} from "../importance";
import { StatusBadge } from "./StatusBadge";
import type { Ticket, TicketStatus } from "../types";

export interface TicketListItemData {
  id: string;
  public_number: number;
  status: TicketStatus;
  closure_type?: Ticket["closure_type"];
  row_label: string;
  desk_label: string;
  description: string;
  created_at?: string;
  updated_at?: string;
  is_escalated?: boolean;
  is_priority?: boolean;
}

interface Props {
  ticket: TicketListItemData;
  selected?: boolean;
  showImportance?: boolean;
  onClick: () => void;
}

export function TicketListItem({
  ticket,
  selected,
  showImportance = true,
  onClick,
}: Props) {
  const timeSource = ticket.created_at ?? ticket.updated_at;
  const created = timeSource
    ? new Date(timeSource).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const importanceTicket = ticket as Ticket;

  return (
    <li
      className={`ticket-card${selected ? " selected" : ""} ticket-card-${ticket.status}`}
      onClick={onClick}
    >
      <div className="ticket-card-top">
        <span className="ticket-card-number">#{ticket.public_number}</span>
        <StatusBadge ticket={ticket} />
        {showImportance && ticket.status !== "closed" && (
          <span className={`badge importance ${importanceClass(importanceTicket)}`}>
            {importanceLabel(importanceTicket)}
          </span>
        )}
      </div>
      <p className="ticket-card-desc">{ticket.description}</p>
      <div className="ticket-card-meta">
        <span className="ticket-card-location">
          <MapPin size={13} strokeWidth={2} aria-hidden />
          {ticket.row_label}, {ticket.desk_label}
        </span>
        {timeSource && (
          <time className="ticket-card-time" dateTime={timeSource}>
            {created}
          </time>
        )}
      </div>
    </li>
  );
}
