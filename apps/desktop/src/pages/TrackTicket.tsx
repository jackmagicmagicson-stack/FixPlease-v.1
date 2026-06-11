import { useCallback, useEffect, useState } from "react";
import { Archive, ClipboardList, Loader2, PlusCircle } from "lucide-react";
import { api } from "../api";
import { ConfirmAction } from "../components/ConfirmAction";
import { EmptyState } from "../components/EmptyState";
import { useEmployeeStatus } from "../components/EmployeeStatusProvider";
import { useInterfacePrefs } from "../components/InterfacePrefsProvider";
import { PageHeader } from "../components/PageHeader";
import { TicketListItem } from "../components/TicketListItem";
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

interface Props {
  onCreateTicket?: () => void;
}

export function TrackTicket({ onCreateTicket }: Props) {
  const { prefs } = useInterfacePrefs();
  const enhanced = prefs.employeeUxEnhanced;
  const { markCurrentRead, refresh: refreshEmployeeStatus } = useEmployeeStatus();

  const [tab, setTab] = useState<ViewTab>("active");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [searchNumber, setSearchNumber] = useState("");
  const [searchError, setSearchError] = useState("");

  const refreshHistory = () => setHistoryVersion((v) => v + 1);

  const loadTicket = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const t = await api.ticket(id);
      upsertTicketHistory(t);
      saveLastTicket(t);
      const msgs = await api.messages(id);
      const atts = await api.attachments(id);
      setTicket(t);
      setMessages(msgs);
      setAttachments(atts);
      if (enhanced) {
        markCurrentRead(id, msgs);
        refreshEmployeeStatus();
      }
      refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [enhanced, markCurrentRead, refreshEmployeeStatus]);

  const syncHistoryStatuses = useCallback(async () => {
    const entries = getTicketHistory();
    await Promise.all(
      entries.slice(0, 20).map(async (e) => {
        try {
          const t = await api.ticket(e.id);
          upsertTicketHistory(t);
        } catch {
          /* заявка удалена на сервере */
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

  const searchByNumber = useCallback(
    async (num: number) => {
      if (!Number.isFinite(num) || num <= 0) {
        setSearchError("Введите корректный номер заявки");
        return;
      }
      setSearchError("");
      setLoading(true);
      try {
        const t = await api.ticketByNumber(num);
        upsertTicketHistory(t);
        saveLastTicket(t);
        setTab(t.status === "closed" ? "history" : "active");
        setSelectedHistoryId(t.status === "closed" ? t.id : null);
        await loadTicket(t.id);
      } catch {
        setSearchError("Заявка не найдена");
      } finally {
        setLoading(false);
      }
    },
    [loadTicket],
  );

  const clearHistory = () => {
    clearTicketHistory();
    setSelectedHistoryId(null);
    setTicket(null);
    refreshHistory();
  };

  const activeEntries = getActiveHistoryEntries();
  const closedEntries = getClosedHistoryEntries();
  const activeCount = activeEntries.length;

  const refreshCurrentTicket = async () => {
    if (!ticket) return;
    await loadTicket(ticket.id);
  };

  const createCta =
    enhanced && onCreateTicket ? (
      <button type="button" className="btn btn-primary" onClick={onCreateTicket}>
        <PlusCircle size={16} strokeWidth={2} aria-hidden />
        Создать заявку
      </button>
    ) : undefined;

  const activeContent = (
    <>
      {loading && !ticket && (
        <EmptyState
          icon={Loader2}
          title="Загрузка заявки"
          description="Получаем актуальный статус с сервера…"
          spinning
        />
      )}
      {!loading && !ticket && !error && (
        <EmptyState
          icon={ClipboardList}
          title="Нет активных заявок"
          description="Создайте новую заявку — администратор увидит её в очереди."
          action={createCta}
        />
      )}
      {ticket && (
        <TicketView
          ticket={ticket}
          messages={messages}
          attachments={attachments}
          onRefresh={refreshCurrentTicket}
          error={error}
        />
      )}
    </>
  );

  const historyContent = (
    <>
      {closedEntries.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="История пуста"
          description="Закрытые заявки появятся здесь после завершения обращений."
        />
      ) : enhanced ? (
        <div className="employee-track-split">
          <ul className="ticket-list ticket-list-cards history-list employee-track-list">
            {closedEntries.map((e) => (
              <TicketListItem
                key={e.id}
                ticket={{
                  id: e.id,
                  public_number: e.public_number,
                  status: e.status,
                  closure_type: null,
                  row_label: e.row_label,
                  desk_label: e.desk_label,
                  description: e.description,
                  updated_at: e.closed_at ?? e.updated_at,
                  is_escalated: false,
                  is_priority: false,
                }}
                selected={selectedHistoryId === e.id}
                showImportance={false}
                onClick={() => {
                  setSelectedHistoryId(e.id);
                  loadTicket(e.id);
                }}
              />
            ))}
          </ul>
          <div className="employee-track-detail">
            {selectedHistoryId && ticket ? (
              <TicketView
                ticket={ticket}
                messages={messages}
                attachments={attachments}
                onRefresh={refreshCurrentTicket}
                error={error}
              />
            ) : (
              <EmptyState
                icon={Archive}
                title="Выберите заявку"
                description="Нажмите на заявку в списке слева, чтобы увидеть детали."
              />
            )}
          </div>
        </div>
      ) : (
        <>
          <ul className="ticket-list ticket-list-cards history-list">
            {closedEntries.map((e) => (
              <TicketListItem
                key={e.id}
                ticket={{
                  id: e.id,
                  public_number: e.public_number,
                  status: e.status,
                  closure_type: null,
                  row_label: e.row_label,
                  desk_label: e.desk_label,
                  description: e.description,
                  updated_at: e.closed_at ?? e.updated_at,
                  is_escalated: false,
                  is_priority: false,
                }}
                selected={selectedHistoryId === e.id}
                showImportance={false}
                onClick={() => {
                  setSelectedHistoryId(e.id);
                  loadTicket(e.id);
                }}
              />
            ))}
          </ul>
          {selectedHistoryId && ticket && (
            <div className="history-detail">
              <TicketView
                ticket={ticket}
                messages={messages}
                attachments={attachments}
                onRefresh={refreshCurrentTicket}
                error={error}
              />
            </div>
          )}
        </>
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
  );

  return (
    <div className={`card page-card page-card-wide${enhanced ? " track-ticket-enhanced" : ""}`}>
      <PageHeader
        title="Мои заявки"
        lead="Активная заявка обновляется сама. История — закрытые обращения с этого компьютера."
      />

      <div className="form-row" style={{ marginBottom: "1rem" }}>
        <label>Найти по номеру</label>
        <div className="toolbar">
          <input
            type="number"
            min={1}
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
            placeholder="Например: 42"
            onKeyDown={(e) => e.key === "Enter" && searchByNumber(parseInt(searchNumber, 10))}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => searchByNumber(parseInt(searchNumber, 10))}
            disabled={loading}
          >
            Найти
          </button>
        </div>
        {searchError && <p className="hint error-text">{searchError}</p>}
      </div>

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

      {tab === "active" &&
        (enhanced && ticket ? (
          <div className="employee-track-split employee-track-active">
            <aside className="employee-track-sidebar">
              <div className="employee-track-sidebar-card">
                <p className="block-title">Активная заявка</p>
                <p className="hint">#{ticket.public_number}</p>
              </div>
            </aside>
            <div className="employee-track-detail">{activeContent}</div>
          </div>
        ) : (
          activeContent
        ))}

      {tab === "history" && historyContent}
    </div>
  );
}
