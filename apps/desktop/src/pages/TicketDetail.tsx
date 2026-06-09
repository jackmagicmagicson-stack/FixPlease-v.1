import { useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader } from "../components/PageHeader";
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    setShowAdvanced(false);
    load();
  }, [ticketId]);

  if (!ticketId) {
    return (
      <div className="card panel-card empty-state-panel">
        <div className="empty-state-icon">←</div>
        <h3>Выберите заявку слева</h3>
        <p className="hint">
          Список отсортирован по важности. Нажмите на строку — здесь откроется карточка с действиями и
          чатом.
        </p>
      </div>
    );
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
    <div className="card panel-card">
      {ticket && (
        <PageHeader
          title={`Заявка #${ticket.public_number}`}
          lead={`${ticket.row_label}, ${ticket.desk_label}`}
        >
          <span className={`status-pill status-${ticket.status}`}>{ticketStatusLabel(ticket)}</span>
        </PageHeader>
      )}

      {error && <div className="error-banner">{error}</div>}

      {ticket && (
        <>
          <section className="content-block">
            <h3 className="block-title">Описание</h3>
            <p>{ticket.description}</p>
            {ticket.status === "closed" && (
              <p className="hint">
                Заявка закрыта и скрыта из активной очереди. История — в фильтре «Закрытые».
              </p>
            )}
          </section>

          {ticket.status !== "closed" && (
            <section className="content-block">
              <h3 className="block-title">Действия</h3>
              <div className="action-bar action-bar-primary">
                {ticket.status === "new" && (
                  <button className="btn btn-primary btn-lg" onClick={() => act(() => api.takeTicket(ticket.id))}>
                    Взять в работу
                  </button>
                )}
                {ticket.status === "in_progress" && (
                  <>
                    <button className="btn btn-primary" onClick={() => act(() => api.resolveTicket(ticket.id))}>
                      Отметить решённой
                    </button>
                    <button
                      className="btn btn-primary btn-lg"
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
                  <button className="btn btn-primary btn-lg" onClick={() => act(() => api.closeTicket(ticket.id))}>
                    Закрыть заявку
                  </button>
                )}
              </div>

              <button
                type="button"
                className="btn btn-link"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Скрыть дополнительные действия" : "Принудительно закрыть или отклонить"}
              </button>

              {showAdvanced && (
                <div className="action-bar action-bar-secondary">
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
                </div>
              )}
            </section>
          )}

          <section className="content-block">
            <h3 className="block-title">Переписка с сотрудником</h3>
            <div className="messages">
              {messages.length === 0 && <p className="hint">Сообщений пока нет.</p>}
              {messages.map((m) => (
                <div key={m.id} className={`message message-${m.author_role}`}>
                  <div className="meta">
                    {m.author_role === "admin" ? "Вы" : "Сотрудник"} —{" "}
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
                  placeholder="Ответить сотруднику…"
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
                  Отправить
                </button>
              </div>
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
        </>
      )}
    </div>
  );
}
