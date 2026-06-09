import { api } from "../api";
import { ticketStatusLabel } from "../statusLabels";
import type { Attachment, Ticket, TicketMessage } from "../types";

interface Props {
  ticket: Ticket;
  messages: TicketMessage[];
  attachments: Attachment[];
  reply: string;
  onReplyChange: (v: string) => void;
  onSendReply: () => void;
  error?: string;
}

export function TicketView({
  ticket,
  messages,
  attachments,
  reply,
  onReplyChange,
  onSendReply,
  error,
}: Props) {
  return (
    <div className="ticket-view">
      {error && <div className="error-banner">{error}</div>}

      <div className="ticket-status-strip">
        <div>
          <span className="ticket-number">#{ticket.public_number}</span>
          <span className={`status-${ticket.status}`}>{ticketStatusLabel(ticket)}</span>
        </div>
        <p className="hint">
          {ticket.row_label}, {ticket.desk_label}
        </p>
      </div>

      <section className="content-block">
        <h3 className="block-title">Описание</h3>
        <p>{ticket.description}</p>
        {ticket.closure_reason && (
          <p className="hint">
            <em>{ticket.closure_reason}</em>
          </p>
        )}
      </section>

      <section className="content-block">
        <h3 className="block-title">Переписка</h3>
        <div className="messages">
          {messages.length === 0 && (
            <p className="hint">Сообщений пока нет. Администратор ответит здесь.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`message message-${m.author_role}`}>
              <div className="meta">
                {m.author_role === "admin" ? "Администратор" : "Вы"} —{" "}
                {new Date(m.created_at).toLocaleString()}
              </div>
              {m.body}
            </div>
          ))}
        </div>
        {ticket.status !== "closed" && (
          <div className="toolbar">
            <input
              style={{ flex: 1 }}
              value={reply}
              onChange={(e) => onReplyChange(e.target.value)}
              placeholder="Написать администратору…"
            />
            <button className="btn btn-primary" onClick={onSendReply}>
              Отправить
            </button>
          </div>
        )}
        {ticket.status === "closed" && (
          <p className="hint">Заявка закрыта. Новые сообщения отправить нельзя.</p>
        )}
      </section>

      {attachments.length > 0 && (
        <section className="content-block">
          <h3 className="block-title">Вложения</h3>
          {attachments.map((a) =>
            a.mime_type.startsWith("image/") ? (
              <img key={a.id} className="preview-img" src={api.attachmentUrl(a.id)} alt={a.filename} />
            ) : (
              <p key={a.id}>
                <a href={api.attachmentUrl(a.id)} target="_blank" rel="noreferrer">
                  {a.filename}
                </a>
              </p>
            ),
          )}
        </section>
      )}
    </div>
  );
}
