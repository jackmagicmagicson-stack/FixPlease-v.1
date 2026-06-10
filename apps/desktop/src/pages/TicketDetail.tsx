import { Check, CheckCheck } from "lucide-react";
import { MousePointerClick } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { ChatThread } from "../components/ChatThread";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
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
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");
  const [chatError, setChatError] = useState("");
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
    setChatError("");
    load();
  }, [ticketId]);

  if (!ticketId) {
    return (
      <div className="card panel-card empty-state-panel">
        <EmptyState
          icon={MousePointerClick}
          title="Выберите заявку слева"
          description="Список отсортирован по важности. Нажмите на карточку — здесь откроются действия и чат."
        />
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

  const nonImageAttachments = attachments.filter((a) => !a.mime_type.startsWith("image/"));

  return (
    <div className="card panel-card ticket-detail-panel">
      {ticket && (
        <PageHeader
          title={`Заявка #${ticket.public_number}`}
          lead={`${ticket.row_label}, ${ticket.desk_label}`}
        >
          <StatusBadge ticket={ticket} className="status-pill-lg" />
        </PageHeader>
      )}

      {error && <div className="error-banner">{error}</div>}

      {ticket && (
        <>
          <section className="content-block">
            <h3 className="block-title">Описание</h3>
            <p className="ticket-description">{ticket.description}</p>
            {ticket.status === "closed" && (
              <p className="hint">
                Заявка закрыта и скрыта из активной очереди. История — в фильтре «Закрытые».
              </p>
            )}
          </section>

          <ChatThread
            ticketId={ticket.id}
            ticketClosed={ticket.status === "closed"}
            viewerRole="admin"
            asAdmin
            messages={messages}
            attachments={attachments}
            onRefresh={load}
            error={chatError}
            onError={setChatError}
          />

          {ticket.status !== "closed" && (
            <section className="content-block ticket-actions-section">
              <h3 className="block-title">Действия</h3>

              {ticket.status === "new" && (
                <div className="ticket-actions">
                  <button
                    className="btn btn-primary btn-lg btn-block"
                    onClick={() => act(() => api.takeTicket(ticket.id))}
                  >
                    Взять в работу
                  </button>
                </div>
              )}

              {ticket.status === "in_progress" && (
                <div className="ticket-actions ticket-actions-split">
                  <button
                    type="button"
                    className="ticket-action-card ticket-action-secondary"
                    onClick={() => act(() => api.resolveTicket(ticket.id))}
                  >
                    <span className="ticket-action-icon" aria-hidden>
                      <Check size={20} strokeWidth={2.25} />
                    </span>
                    <span className="ticket-action-label">Отметить решённой</span>
                    <span className="ticket-action-hint">
                      Статус «Решена» — сотрудник ещё может написать в чат
                    </span>
                  </button>

                  <button
                    type="button"
                    className="ticket-action-card ticket-action-primary"
                    onClick={() =>
                      act(async () => {
                        await api.resolveTicket(ticket.id);
                        return api.closeTicket(ticket.id);
                      })
                    }
                  >
                    <span className="ticket-action-icon" aria-hidden>
                      <CheckCheck size={20} strokeWidth={2.25} />
                    </span>
                    <span className="ticket-action-label">Решить и закрыть</span>
                    <span className="ticket-action-hint">
                      Типичный сценарий — заявка сразу уходит в архив
                    </span>
                  </button>
                </div>
              )}

              {ticket.status === "resolved" && (
                <div className="ticket-actions">
                  <button
                    className="btn btn-primary btn-lg btn-block"
                    onClick={() => act(() => api.closeTicket(ticket.id))}
                  >
                    Закрыть заявку
                  </button>
                </div>
              )}

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
        </>
      )}
    </div>
  );
}
