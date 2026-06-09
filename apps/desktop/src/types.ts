export type TicketStatus =
  | "draft"
  | "new"
  | "in_progress"
  | "resolved"
  | "closed";

export type ClosureType = "normal" | "rejected" | "forced";

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_system: boolean;
  allows_priority: boolean;
}

export interface CategoryTemplate {
  id: string;
  category_id: string;
  title: string;
  body: string;
  sort_order: number;
}

export interface Ticket {
  id: string;
  public_number: number;
  row_label: string;
  desk_label: string;
  category_id: string;
  description: string;
  status: TicketStatus;
  closure_type: ClosureType | null;
  closure_reason: string | null;
  assigned_admin_id: string | null;
  is_priority: boolean;
  is_escalated: boolean;
  created_at: string;
  submitted_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_role: "employee" | "admin";
  author_admin_id: string | null;
  body: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  ticket_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface StatsResponse {
  total_tickets: number;
  open_tickets: number;
  closed_tickets: number;
  avg_first_response_minutes: number | null;
  by_category: { category_name: string; count: number }[];
  by_admin: {
    admin_name: string;
    assigned_count: number;
    closed_count: number;
  }[];
  close_rate_percent: number;
}

export type WsEvent =
  | { type: "ticket_created"; ticket: Ticket }
  | { type: "ticket_updated"; ticket: Ticket }
  | { type: "message_created"; message: TicketMessage }
  | {
      type: "ticket_escalated";
      ticket_id: string;
      public_number: number;
    };
