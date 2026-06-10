import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";
import { api } from "../api";
import { subscribe } from "../ws";
import {
  SORT_OPTIONS,
  type TicketSortMode,
} from "../importance";
import { ConfirmAction } from "../components/ConfirmAction";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { TicketListItem } from "../components/TicketListItem";
import { notifyTicketsChanged, TICKETS_CHANGED } from "../ticketEvents";
import type { Category, Ticket, TicketStatus } from "../types";

interface Props {
  onSelect: (t: Ticket | null) => void;
  selectedId?: string;
}

const SORT_STORAGE_KEY = "admin_ticket_sort";
const FILTER_STORAGE_KEY = "admin_ticket_status_filter";

type StatusFilter = "active" | TicketStatus | "" | "escalated";

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Активные" },
  { value: "", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "in_progress", label: "В работе" },
  { value: "resolved", label: "Решённые" },
  { value: "closed", label: "Закрытые" },
];

function applyStatusFilter(list: Ticket[], filter: StatusFilter): Ticket[] {
  if (filter === "active") {
    return list.filter((t) => t.status !== "closed");
  }
  if (filter === "escalated") {
    return list.filter((t) => t.is_escalated && t.status !== "closed");
  }
  if (filter) {
    return list.filter((t) => t.status === filter);
  }
  return list;
}

export function AdminQueue({ onSelect, selectedId }: Props) {
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (
      saved === "active" ||
      saved === "" ||
      saved === "closed" ||
      saved === "new" ||
      saved === "in_progress" ||
      saved === "resolved" ||
      saved === "escalated"
    ) {
      return saved as StatusFilter;
    }
    return "active";
  });
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortMode, setSortMode] = useState<TicketSortMode>(() => {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved === "newest" || saved === "oldest" || saved === "importance") {
      return saved;
    }
    return "importance";
  });
  const [error, setError] = useState("");
  const [purgeMsg, setPurgeMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const tickets = useMemo(
    () => applyStatusFilter(allTickets, statusFilter),
    [allTickets, statusFilter],
  );

  const kpi = useMemo(
    () => ({
      new: allTickets.filter((t) => t.status === "new").length,
      inProgress: allTickets.filter((t) => t.status === "in_progress").length,
      escalated: allTickets.filter((t) => t.is_escalated && t.status !== "closed").length,
    }),
    [allTickets],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.tickets({
        category_id: categoryFilter || undefined,
        sort: sortMode,
      });
      setAllTickets(list);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, sortMode]);

  useEffect(() => {
    api.categories().then(setCategories);
    refresh();
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, sortMode);
  }, [sortMode]);

  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(TICKETS_CHANGED, onChange);
    return () => window.removeEventListener(TICKETS_CHANGED, onChange);
  }, [refresh]);

  useEffect(() => {
    return subscribe((ev) => {
      if (
        ev.type === "ticket_created" ||
        ev.type === "ticket_updated" ||
        ev.type === "ticket_escalated"
      ) {
        refresh();
        if (ev.type === "ticket_updated" && ev.ticket.status === "closed" && ev.ticket.id === selectedId) {
          onSelect(null);
        }
      }
    });
  }, [refresh, selectedId, onSelect]);

  const clearHistory = async () => {
    setPurgeMsg("");
    setError("");
    try {
      const res = await api.purgeClosed(false);
      setPurgeMsg(res.deleted > 0 ? `Удалено заявок: ${res.deleted}` : "Нет закрытых заявок для удаления");
      onSelect(null);
      setAllTickets([]);
      await refresh();
      notifyTicketsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const activeCount = allTickets.filter((t) => t.status !== "closed").length;

  return (
    <div className="card panel-card queue-panel">
      <PageHeader title={activeCount > 0 ? `Очередь · ${activeCount}` : "Очередь"} />

      {error && <div className="error-banner">{error}</div>}
      {purgeMsg && <div className="success-banner">{purgeMsg}</div>}

      <div className="queue-kpi" role="group" aria-label="Сводка очереди">
        <button
          type="button"
          className={`queue-kpi-item${statusFilter === "new" ? " active" : ""}`}
          onClick={() => setStatusFilter("new")}
        >
          <span className="queue-kpi-value">{kpi.new}</span>
          <span className="queue-kpi-label">Новые</span>
        </button>
        <button
          type="button"
          className={`queue-kpi-item${statusFilter === "in_progress" ? " active" : ""}`}
          onClick={() => setStatusFilter("in_progress")}
        >
          <span className="queue-kpi-value">{kpi.inProgress}</span>
          <span className="queue-kpi-label">В работе</span>
        </button>
        <button
          type="button"
          className={`queue-kpi-item${statusFilter === "escalated" ? " active" : ""}${kpi.escalated > 0 ? " queue-kpi-alert" : ""}`}
          onClick={() => setStatusFilter("escalated")}
        >
          <span className="queue-kpi-value">{kpi.escalated}</span>
          <span className="queue-kpi-label">Эскалация</span>
        </button>
      </div>

      <nav className="queue-filter-chips" aria-label="Фильтр по статусу">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value || "all"}
            type="button"
            className={statusFilter === chip.value ? "active" : ""}
            onClick={() => setStatusFilter(chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </nav>

      <div className="queue-toolbar">
        <div className="queue-filter-row">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as TicketSortMode)}
            aria-label="Сортировка"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Категория"
          >
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="queue-refresh-btn"
          onClick={refresh}
          disabled={loading}
          aria-label="Обновить"
          title="Обновить"
        >
          <RefreshCw size={16} strokeWidth={2} className={loading ? "spin" : undefined} />
        </button>
      </div>

      {loading && tickets.length === 0 ? (
        <div className="ticket-list-skeleton">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={statusFilter === "active" ? "Очередь пуста" : "Заявок не найдено"}
          description={
            statusFilter === "active"
              ? "Нет активных обращений."
              : "Попробуйте другой фильтр или дождитесь новых заявок."
          }
          action={
            statusFilter === "active" ? (
              <button type="button" className="btn btn-primary" onClick={() => setStatusFilter("closed")}>
                Показать закрытые
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="ticket-list ticket-list-cards">
          {tickets.map((t) => (
            <TicketListItem
              key={t.id}
              ticket={t}
              selected={t.id === selectedId}
              onClick={() => onSelect(t)}
            />
          ))}
        </ul>
      )}

      {statusFilter === "closed" && (
        <section className="maintenance-section">
          <ConfirmAction
            label="Очистить историю"
            confirmText="Все закрытые заявки будут удалены из системы. Это действие необратимо."
            onConfirm={clearHistory}
          />
        </section>
      )}
    </div>
  );
}
