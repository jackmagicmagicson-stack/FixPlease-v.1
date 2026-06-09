import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ConfirmAction } from "../components/ConfirmAction";
import { PageHeader } from "../components/PageHeader";
import { TicketView } from "../components/TicketView";
import { getLastTicketId, saveLastTicket } from "../notify";
import {
  clearTicketHistory,
  getActiveHistoryEntries,
  getClosedHistoryEntries,
  getTicketHistory,
  upsertTicketHistory,
} from "../ticketHistory";
import { subscribe } from "../ws";
import type { Attachment, Ticket, TicketMessage } from "../types";

type ViewTab = "active" | "history";

export function TrackTicket() {
  const [tab, setTab] = useState<ViewTab>("active");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const refreshHistory = () => setHistoryVersion((v) => v + 1);

  const loadTicket = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const t = await api.ticket(id);
      upsertTicketHistory(t);
      saveLastTicket(t);
      setTicket(t);
      setMessages(await api.messages(id));
      setAttachments(await api.attachments(id));
      refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncHistoryStatuses = useCallback(async () => {
    const entries = getTicketHistory();
    await Promise.all(
      entries.slice(0, 20).map(async (e) => {
        try {
          const t = await api.ticket(e.id);
          upsertTicketHistory(t);
        } catch {
          /* заявка удалена на сервере — оставляем локальную запись */
        }
      }),
    );
    refreshHistory();
  }, []);

  useEffect(() => {
    const lastId = getLastTicketId();
    if (lastId && !getTicketHistory().some((e) => e.id === lastId)) {
      api
        .ticket(lastId)
        .then((t) => {
          upsertTicketHistory(t);
          refreshHistory();
        })
        .catch(() => {});
    }
    syncHistoryStatuses();
  }, [syncHistoryStatuses]);

  useEffect(() => {
    if (tab !== "active") return;
    const active = getActiveHistoryEntries();
    if (active.length > 0) {
      loadTicket(active[0].id);
    } else {
      setTicket(null);
      setMessages([]);
      setAttachments([]);
    }
  }, [tab, historyVersion, loadTicket]);

  useEffect(() => {
    return subscribe((ev) => {
      const historyIds = new Set(getTicketHistory().map((e) => e.id));
      if (ev.type === "ticket_updated" && historyIds.has(ev.ticket.id)) {
        upsertTicketHistory(ev.ticket);
        refreshHistory();
        if (ticket?.id === ev.ticket.id) {
          loadTicket(ev.ticket.id);
        }
      }
      if (
        ev.type === "message_created" &&
        ticket &&
        ev.message.ticket_id === ticket.id
      ) {
        loadTicket(ticket.id);
      }
    });
  }, [ticket, loadTicket]);

  const sendReply = async () => {
    if (!ticket || !reply.trim()) return;
    try {
      const msg = await api.sendMessage(ticket.id, reply);
      setMessages((m) => [...m, msg]);
      setReply("");
    } catch (e) {
      setError(String(e));
    }
  };

  const clearHistory = () => {
    clearTicketHistory();
    setSelectedHistoryId(null);
    setTicket(null);
    refreshHistory();
  };

  const activeEntries = getActiveHistoryEntries();
  const closedEntries = getClosedHistoryEntries();
  const activeCount = activeEntries.length;

  return (
    <div className="card page-card page-card-wide">
      <PageHeader
        title="Мои заявки"
        lead="Активная заявка обновляется сама. История — закрытые обращения с этого компьютера."
      />

      <nav className="sub-tabs" aria-label="Раздел заявок">
        <button
          type="button"
          className={tab === "active" ? "active" : ""}
          onClick={() => {
            setTab("active");
            setSelectedHistoryId(null);
          }}
        >
          Активная{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
        <button
          type="button"
          className={tab === "history" ? "active" : ""}
          onClick={() => setTab("history")}
        >
          История{closedEntries.length > 0 ? ` (${closedEntries.length})` : ""}
        </button>
      </nav>

      {tab === "active" && (
        <>
          {loading && !ticket && <div className="empty">Загрузка…</div>}
          {!loading && !ticket && !error && (
            <div className="empty">
              Нет активных заявок. Создайте новую во вкладке «Новая заявка».
            </div>
          )}
          {ticket && (
            <TicketView
              ticket={ticket}
              messages={messages}
              attachments={attachments}
              reply={reply}
              onReplyChange={setReply}
              onSendReply={sendReply}
              error={error}
            />
          )}
          {!ticket && error && <div className="error-banner">{error}</div>}
        </>
      )}

      {tab === "history" && (
        <>
          {closedEntries.length === 0 ? (
            <div className="empty">Закрытых заявок пока нет.</div>
          ) : (
            <ul className="ticket-list history-list">
              {closedEntries.map((e) => (
                <li
                  key={e.id}
                  className={selectedHistoryId === e.id ? "selected" : undefined}
                  onClick={() => {
                    setSelectedHistoryId(e.id);
                    loadTicket(e.id);
                  }}
                >
                  <div className="ticket-row-head">
                    <strong>#{e.public_number}</strong>{" "}
                    <span className="status-closed">Закрыта</span>
                  </div>
                  <small>
                    {e.row_label}, {e.desk_label} — {e.description.slice(0, 60)}
                  </small>
                  {e.closed_at && (
                    <small className="hint">
                      Закрыта: {new Date(e.closed_at).toLocaleString()}
                    </small>
                  )}
                </li>
              ))}
            </ul>
          )}

          {selectedHistoryId && ticket && (
            <div className="history-detail">
              <TicketView
                ticket={ticket}
                messages={messages}
                attachments={attachments}
                reply={reply}
                onReplyChange={setReply}
                onSendReply={sendReply}
                error={error}
              />
            </div>
          )}

          {closedEntries.length > 0 && (
            <section className="maintenance-section">
              <h4 className="block-title">Очистка</h4>
              <p className="hint">
                Удаляет список истории только на этом компьютере. Заявки на сервере не затрагиваются.
              </p>
              <ConfirmAction
                label="Очистить историю"
                confirmText="Список истории исчезнет только на этом компьютере. Заявки на сервере останутся."
                onConfirm={clearHistory}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
