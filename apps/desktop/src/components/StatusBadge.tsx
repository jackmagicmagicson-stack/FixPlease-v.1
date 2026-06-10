import { CheckCircle2, Circle, Clock, Lock, Sparkles } from "lucide-react";
import { ticketStatusLabel } from "../statusLabels";
import type { Ticket } from "../types";

interface Props {
  ticket: Pick<Ticket, "status" | "closure_type"> | { status: Ticket["status"]; closure_type?: Ticket["closure_type"] };
  className?: string;
}

const STATUS_ICONS = {
  draft: Circle,
  new: Sparkles,
  in_progress: Clock,
  resolved: CheckCircle2,
  closed: Lock,
} as const;

export function StatusBadge({ ticket, className = "" }: Props) {
  const Icon = STATUS_ICONS[ticket.status] ?? Circle;
  const label = ticketStatusLabel({
    status: ticket.status,
    closure_type: ticket.closure_type ?? null,
  });

  return (
    <span className={`status-badge status-${ticket.status} ${className}`.trim()}>
      <Icon size={12} strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}
