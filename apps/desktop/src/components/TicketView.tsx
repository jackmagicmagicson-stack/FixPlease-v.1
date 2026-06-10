import { useState } from "react";
import { api } from "../api";
import { ChatThread } from "./ChatThread";
import { StatusBadge } from "./StatusBadge";
import type { Attachment, Ticket, TicketMessage } from "../types";

interface Props {
  ticket: Ticket;
  messages: TicketMessage[];
  attachments: Attachment[];
  onRefresh: () => void | Promise<void>;
  error?: string;
}

export function TicketView({
  ticket,
  messages,
  attachments,
  onRefresh,
  error,
}: Props) {
  const [chatError, setChatError] = useState("");
  const nonImageAttachments = attachments.filter((a) => !a.mime_type.startsWith("image/"));

  return (
    <div className="ticket-view">
      {error && <div className="error-banner">{error}</div>}

      <div className="ticket-status-strip">
        <div className="ticket-status-strip-top">
          <span className="ticket-number">#{ticket.public_number}</span>
          <StatusBadge ticket={ticket} />
        </div>
        <p className="hint">
          {ticket.row_label}, {ticket.desk_label}
        </p>
      </div>

      <section className="content-block">
        <h3 className="block-title">Описание</h3>
        <p className="ticket-description">{ticket.description}</p>
        {ticket.closure_reason && (
          <p className="hint">
            <em>{ticket.closure_reason}</em>
          </p>
        )}
      </section>

      <ChatThread
        ticketId={ticket.id}
        ticketClosed={ticket.status === "closed"}
        viewerRole="employee"
        asAdmin={false}
        messages={messages}
        attachments={attachments}
        onRefresh={onRefresh}
        error={chatError}
        onError={setChatError}
      />

      {nonImageAttachments.length > 0 && (
        <section className="content-block">
          <h3 className="block-title">Файлы</h3>
          {nonImageAttachments.map((a) => (
            <p key={a.id}>
              <a href={api.attachmentUrl(a.id)} target="_blank" rel="noreferrer">
                {a.filename}
              </a>
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
