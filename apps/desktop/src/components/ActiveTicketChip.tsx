import { ticketStatusLabel } from "../statusLabels";
import type { Ticket } from "../types";

interface Props {
  ticket: Ticket;
  unreadCount?: number;
  onClick: () => void;
}

export function ActiveTicketChip({ ticket, unreadCount = 0, onClick }: Props) {
  return (
    <button type="button" className="active-ticket-chip" onClick={onClick}>
      <span className="active-ticket-chip-label">
        #{ticket.public_number} — {ticketStatusLabel(ticket)}
      </span>
      {unreadCount > 0 && (
        <span className="nav-badge" aria-label={`${unreadCount} новых сообщений`}>
          {unreadCount}
        </span>
      )}
    </button>
  );
}
