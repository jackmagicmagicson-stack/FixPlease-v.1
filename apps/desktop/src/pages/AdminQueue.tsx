import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { subscribe } from "../ws";
import {
  importanceClass,
  importanceLabel,
  SORT_OPTIONS,
  type TicketSortMode,
} from "../importance";
import { ticketStatusLabel } from "../statusLabels";
import { TICKETS_CHANGED } from "../ticketEvents";
import type { Category, Ticket, TicketStatus } from "../types";

interface Props {
  onSelect: (t: Ticket | null) => void;
  selectedId?: string;
}

const SORT_STORAGE_KEY = "admin_ticket_sort";
const FILTER_STORAGE_KEY = "admin_ticket_status_filter";

type StatusFilter = "active" | TicketStatus | "";

function applyStatusFilter(list: Ticket[], filter: StatusFilter): Ticket[] {
  if (filter === "active") {
    return list.filter((t) => t.status !== "closed");
  }
  if (filter) {
    return list.filter((t) => t.status === filter);
  }
  return list;
}

export function AdminQueue({ onSelect, selectedId }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved === "active" || saved === "" || saved === "closed" || saved === "new" || saved === "in_progress" || saved === "resolved") {
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

  const refresh = useCallback(async () => {
    try {
      const list = await api.tickets({
        category_id: categoryFilter || undefined,
        sort: sortMode,
      });
      setTickets(applyStatusFilter(list, statusFilter));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [statusFilter, categoryFilter, sortMode]);

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

  const purgeClosed = async (mineOnly: boolean) => {
    const label = mineOnly
      ? "Удалить из истории все закрытые заявки, которые вы обрабатывали?"
      : "Удалить из истории ВСЕ закрытые заявки в системе?";
    if (!window.confirm(`${label}\n\nДействие необратимо.`)) return;
    setPurgeMsg("");
    setError("");
    try {
      const res = await api.purgeClosed(mineOnly);
      setPurgeMsg(`Удалено заявок: ${res.deleted}`);
      onSelect(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="card">
      <h2>Очередь заявок</h2>
      {error && <div className="error-banner">{error}</div>}
      {purgeMsg && <div className="success-banner">{purgeMsg}</div>}
      <div className="toolbar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="active">Активные (без закрытых)</option>
          <option value="">Все статусы</option>
          <option value="new">Новые</option>
          <option value="in_progress">В работе</option>
          <option value="resolved">Решённые</option>
          <option value="closed">Закрытые</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as TicketSortMode)}
          title="Сортировка очереди"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="btn" onClick={refresh}>
          Обновить
        </button>
      </div>
      <div className="toolbar purge-toolbar">
        <button
          type="button"
          className="btn"
          onClick={() => purgeClosed(true)}
          title="Удаляет ваши закрытые заявки из базы"
        >
          Очистить мои закрытые
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => purgeClosed(false)}
          title="Удаляет все закрытые заявки из базы"
        >
          Очистить все закрытые
        </button>
      </div>
      {sortMode === "importance" && statusFilter === "active" && (
        <p className="hint importance-hint">
          Иерархия: критичная (эскалация + приоритет) → эскалация → приоритет (Интернет) →
          обычная; внутри уровня — дольше ждут выше.
        </p>
      )}
      {tickets.length === 0 ? (
        <div className="empty">
          {statusFilter === "active"
            ? "Нет активных заявок. Закрытые скрыты — выберите «Закрытые» в фильтре."
            : "Нет заявок"}
        </div>
      ) : (
        <ul className="ticket-list">
          {tickets.map((t) => (
            <li
              key={t.id}
              className={t.id === selectedId ? "selected" : undefined}
              onClick={() => onSelect(t)}
            >
              <div className="ticket-row-head">
                <strong>#{t.public_number}</strong>{" "}
                <span className={`status-${t.status}`}>{ticketStatusLabel(t)}</span>
                {t.status !== "closed" && (
                  <span className={`badge importance ${importanceClass(t)}`}>
                    {importanceLabel(t)}
                  </span>
                )}
              </div>
              <small>
                {t.row_label}, {t.desk_label} — {t.description.slice(0, 60)}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
