import { useEffect, useState } from "react";
import { api, getServerUrl, setServerUrl } from "../api";
import { FormSection } from "../components/FormSection";
import { PageHeader } from "../components/PageHeader";
import {
  clearLastLocation,
  getLastLocation,
  hasSavedLocation,
  saveLastLocation,
} from "../locationMemory";

interface Props {
  isAdmin: boolean;
  onLogout: () => void;
}

export function Settings({ isAdmin, onLogout }: Props) {
  const [url, setUrl] = useState(getServerUrl());
  const [row, setRow] = useState("");
  const [desk, setDesk] = useState("");

  useEffect(() => {
    setUrl(getServerUrl());
    const loc = getLastLocation();
    setRow(loc.row);
    setDesk(loc.desk);
  }, []);

  const [quietStart, setQuietStart] = useState(localStorage.getItem("quiet_start") || "");
  const [quietEnd, setQuietEnd] = useState(localStorage.getItem("quiet_end") || "");
  const [escalation, setEscalation] = useState(15);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setServerUrl(url);
    saveLastLocation(row, desk);
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
    <div className="card page-card">
      <PageHeader
        title="Настройки"
        lead={
          isAdmin
            ? "Подключение к серверу и параметры работы системы."
            : "Обычно всё уже настроено IT-отделом при установке программы."
        }
      />
      {msg && <div className="success-banner">{msg}</div>}

      <FormSection
        title="Подключение к серверу"
        hint={isAdmin ? undefined : "Меняйте только по указанию IT-отдела"}
      >
        <div className="form-row">
          <label>Адрес сервера</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://127.0.0.1:8080"
            readOnly={!isAdmin}
            className={!isAdmin ? "input-readonly" : undefined}
          />
          {!isAdmin && (
            <p className="hint">Адрес задаётся один раз при установке на всех компьютерах офиса.</p>
          )}
        </div>
      </FormSection>

      {!isAdmin && (
        <FormSection
          title="Моё место в офисе"
          hint="Подставляется при создании новой заявки — можно изменить в любой момент"
        >
          <div className="form-grid-2">
            <div className="form-row">
              <label>Ряд</label>
              <input value={row} onChange={(e) => setRow(e.target.value)} placeholder="3 ряд" />
            </div>
            <div className="form-row">
              <label>Стол</label>
              <input value={desk} onChange={(e) => setDesk(e.target.value)} placeholder="5 стол" />
            </div>
          </div>
          {hasSavedLocation() && (
            <button
              type="button"
              className="btn btn-link"
              onClick={() => {
                clearLastLocation();
                setRow("");
                setDesk("");
              }}
            >
              Сбросить запомненное место
            </button>
          )}
        </FormSection>
      )}

      <FormSection title="Уведомления" hint="В «тихие часы» звуковые оповещения не воспроизводятся">
        <div className="form-grid-2">
          <div className="form-row">
            <label>Тихие часы — с</label>
            <input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Тихие часы — до</label>
            <input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />
          </div>
        </div>
      </FormSection>

      {isAdmin && (
        <FormSection title="Параметры очереди" hint="Влияют на всех администраторов">
          <div className="form-row">
            <label>Эскалация (минут без ответа)</label>
            <input
              type="number"
              value={escalation}
              onChange={(e) => setEscalation(parseInt(e.target.value, 10))}
            />
          </div>
        </FormSection>
      )}

      <div className="action-bar action-bar-primary">
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
