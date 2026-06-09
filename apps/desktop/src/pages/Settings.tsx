import { useEffect, useState } from "react";
import { api, getServerUrl, setServerUrl } from "../api";

interface Props {
  isAdmin: boolean;
  onLogout: () => void;
}

export function Settings({ isAdmin, onLogout }: Props) {
  const [url, setUrl] = useState(getServerUrl());

  useEffect(() => {
    setUrl(getServerUrl());
  }, []);
  const [quietStart, setQuietStart] = useState(localStorage.getItem("quiet_start") || "");
  const [quietEnd, setQuietEnd] = useState(localStorage.getItem("quiet_end") || "");
  const [escalation, setEscalation] = useState(15);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setServerUrl(url);
    localStorage.setItem("quiet_start", quietStart);
    localStorage.setItem("quiet_end", quietEnd);
    if (isAdmin) {
      await api.updateSettings({
        escalation_minutes: escalation,
        quiet_hours_start: quietStart || null,
        quiet_hours_end: quietEnd || null,
      });
    }
    setMsg("Сохранено");
  };

  return (
    <div className="card">
      <h2>Настройки</h2>
      {msg && <div className="success-banner">{msg}</div>}
      <div className="form-row">
        <label>URL сервера</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://127.0.0.1:8080"
        />
        <p className="hint">Для разработки: API на порту 8080. В проде — https://IP-вашего-сервера</p>
      </div>
      <div className="form-row">
        <label>Тихие часы (с)</label>
        <input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />
      </div>
      <div className="form-row">
        <label>Тихие часы (до)</label>
        <input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />
      </div>
      {isAdmin && (
        <div className="form-row">
          <label>Эскалация (минут)</label>
          <input
            type="number"
            value={escalation}
            onChange={(e) => setEscalation(parseInt(e.target.value, 10))}
          />
        </div>
      )}
      <div className="toolbar">
        <button className="btn btn-primary" onClick={save}>
          Сохранить
        </button>
        {isAdmin && (
          <button className="btn" onClick={onLogout}>
            Выйти из кабинета
          </button>
        )}
      </div>
    </div>
  );
}
