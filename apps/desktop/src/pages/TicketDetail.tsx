import { useEffect, useState } from "react";
import { api } from "../api";
import { ticketStatusLabel } from "../statusLabels";
import { notifyTicketsChanged } from "../ticketEvents";
import type { Attachment, Ticket, TicketMessage } from "../types";

interface Props {
  ticketId: string | null;
  onUpdated: (ticket: Ticket) => void;
}

export function TicketDetail({ ticketId, onUpdated }: Props) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reply, setReply] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    if (!ticketId) return;
    try {
      const t = await api.ticket(ticketId);
      setTicket(t);
      setMessages(await api.messages(ticketId));
      setAttachments(await api.attachments(ticketId));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    load();
  }, [ticketId]);

  if (!ticketId) {
    return <div className="card empty">Выберите заявку из очереди</div>;
  }

  const act = async (fn: () => Promise<Ticket>) => {
    setError("");
    try {
      const t = await fn();
      setTicket(t);
      notifyTicketsChanged();
      onUpdated(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="card">
      <h2>Заявка #{ticket?.public_number}</h2>
      {error && <div className="error-banner">{error}</div>}
      {ticket && (
        <>
          <p>
            {ticket.row_label}, {ticket.desk_label} —{" "}
            <span className={`status-${ticket.status}`}>{ticketStatusLabel(ticket)}</span>
          </p>
          <p>{ticket.description}</p>
          {ticket.status === "closed" && (
            <p className="hint">
              Заявка закрыта. Она скрыта из активной очереди; смотрите фильтр «Закрытые» или
              очистите историю.
            </p>
          )}
          <div className="toolbar">
            {ticket.status === "new" && (
              <button className="btn btn-primary" onClick={() => act(() => api.takeTicket(ticket.id))}>
                Взять в работу
              </button>
            )}
            {ticket.status === "in_progress" && (
              <>
                <button className="btn btn-primary" onClick={() => act(() => api.resolveTicket(ticket.id))}>
                  Решена
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    act(async () => {
                      await api.resolveTicket(ticket.id);
                      return api.closeTicket(ticket.id);
                    })
                  }
                >
                  Решить и закрыть
                </button>
              </>
            )}
            {ticket.status === "resolved" && (
              <button className="btn btn-primary" onClick={() => act(() => api.closeTicket(ticket.id))}>
                Закрыть
              </button>
            )}
            {ticket.status !== "closed" && (
              <>
                <button
                  className="btn"
                  onClick={() => act(() => api.closeTicket(ticket.id, "Принудительное закрытие"))}
                >
                  Закрыть принудительно
                </button>
                <input
                  placeholder="Причина отклонения"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <button
                  className="btn"
                  onClick={() => act(() => api.rejectTicket(ticket.id, rejectReason))}
                  disabled={!rejectReason.trim()}
                >
                  Отклонить
                </button>
              </>
            )}
          </div>
          <div className="messages">
            {messages.map((m) => (
              <div key={m.id} className="message">
                <div className="meta">
                  {m.author_role === "admin" ? "Администратор" : "Сотрудник"} —{" "}
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
                onChange={(e) => setReply(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={async () => {
                  await api.sendMessage(ticket.id, reply, true);
                  setReply("");
                  load();
                  notifyTicketsChanged();
                }}
              >
                Ответить
              </button>
            </div>
          )}
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
        </>
      )}
    </div>
  );
}
