import { useEffect, useState } from "react";
import { api } from "../api";
import type { StatsResponse } from "../types";

export function Stats() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "custom">("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");

  const range = () => {
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
    return { from: from || undefined, to: to || undefined };
  };

  useEffect(() => {
    const r = range();
    api
      .stats(r.from, r.to)
      .then(setStats)
      .catch((e) => setError(String(e)));
  }, [period, from, to]);

  if (!stats && !error) return <div className="empty">Загрузка...</div>;

  return (
    <div className="card">
      <h2>Статистика</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        {(["day", "week", "month", "custom"] as const).map((p) => (
          <button
            key={p}
            className={`btn ${period === p ? "btn-primary" : ""}`}
            onClick={() => setPeriod(p)}
          >
            {p === "day" ? "День" : p === "week" ? "Неделя" : p === "month" ? "Месяц" : "Период"}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="toolbar">
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      )}
      {stats && (
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
          <h3>По категориям</h3>
          <ul>
            {stats.by_category.map((c) => (
              <li key={c.category_name}>
                {c.category_name}: {c.count}
              </li>
            ))}
          </ul>
          <h3>По администраторам</h3>
          <ul>
            {stats.by_admin.map((a) => (
              <li key={a.admin_name}>
                {a.admin_name}: назначено {a.assigned_count}, закрыто {a.closed_count}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
