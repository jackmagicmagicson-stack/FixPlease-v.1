import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader } from "../components/PageHeader";
import type { StatsResponse } from "../types";

type Period = "day" | "week" | "month" | "custom";

function datetimeLocalToIso(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function buildRange(
  period: Period,
  customFrom: string,
  customTo: string,
): { from?: string; to?: string; incomplete?: boolean; validationError?: string } {
  const now = new Date();
  const toDate = now.toISOString();

  if (period === "day") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { from: d.toISOString(), to: toDate };
  }
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { from: d.toISOString(), to: toDate };
  }
  if (period === "month") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return { from: d.toISOString(), to: toDate };
  }

  if (!customFrom.trim() || !customTo.trim()) {
    return { incomplete: true };
  }

  const fromIso = datetimeLocalToIso(customFrom);
  const toIso = datetimeLocalToIso(customTo);

  if (!fromIso || !toIso) {
    return { validationError: "Некорректный формат даты." };
  }
  if (new Date(fromIso) > new Date(toIso)) {
    return { validationError: "Дата «с» должна быть раньше даты «по»." };
  }

  return { from: fromIso, to: toIso };
}

export function Stats() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    const range = buildRange(period, from, to);

    if (range.incomplete) {
      setLoading(false);
      setError("");
      setStats(null);
      return;
    }

    if (range.validationError) {
      setLoading(false);
      setError(range.validationError);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await api.stats(range.from, range.to);
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const customWaiting = period === "custom" && (!from.trim() || !to.trim());

  return (
    <div className="card page-card">
      <PageHeader
        title="Отчёты"
        lead="Сводка по заявкам за выбранный период. Для оценки нагрузки и скорости реакции."
      />
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        {(["day", "week", "month", "custom"] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`btn ${period === p ? "btn-primary" : ""}`}
            onClick={() => setPeriod(p)}
          >
            {p === "day" ? "День" : p === "week" ? "Неделя" : p === "month" ? "Месяц" : "Период"}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="stats-custom-range">
          <label className="filter-field">
            <span className="filter-label">С</span>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="filter-field">
            <span className="filter-label">По</span>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      )}
      {loading && !customWaiting && <div className="empty">Загрузка…</div>}
      {customWaiting && !error && (
        <div className="empty">Укажите начало и конец периода.</div>
      )}
      {!loading && stats && !customWaiting && (
        <>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="value">{stats.total_tickets}</div>
              <div className="label">Всего</div>
            </div>
            <div className="stat-box">
              <div className="value">{stats.open_tickets}</div>
              <div className="label">Открытых</div>
            </div>
            <div className="stat-box">
              <div className="value">{stats.closed_tickets}</div>
              <div className="label">Закрытых</div>
            </div>
            <div className="stat-box">
              <div className="value">
                {stats.avg_first_response_minutes?.toFixed(0) ?? "—"}
              </div>
              <div className="label">Ср. реакция (мин)</div>
            </div>
            <div className="stat-box">
              <div className="value">{stats.close_rate_percent.toFixed(0)}%</div>
              <div className="label">Закрыто</div>
            </div>
          </div>
          <h3 className="block-title">По категориям</h3>
          {stats.by_category.length === 0 ? (
            <p className="hint">Нет данных за период.</p>
          ) : (
            <ul className="stats-list">
              {stats.by_category.map((c) => (
                <li key={c.category_name}>
                  {c.category_name}: {c.count}
                </li>
              ))}
            </ul>
          )}
          <h3 className="block-title">По администраторам</h3>
          {stats.by_admin.length === 0 ? (
            <p className="hint">Нет данных за период.</p>
          ) : (
            <ul className="stats-list">
              {stats.by_admin.map((a) => (
                <li key={a.admin_name}>
                  {a.admin_name}: назначено {a.assigned_count}, закрыто {a.closed_count}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
