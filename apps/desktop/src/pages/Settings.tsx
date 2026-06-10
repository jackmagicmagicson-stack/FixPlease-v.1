import { useEffect, useState } from "react";
import {
  api,
  checkServerAt,
  getServerUrl,
  isValidServerUrl,
  normalizeServerUrl,
  setServerUrl,
} from "../api";
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
  onServerSaved?: (ok: boolean) => void;
}

export function Settings({ isAdmin, onLogout, onServerSaved }: Props) {
  const [url, setUrl] = useState(getServerUrl());
  const [row, setRow] = useState("");
  const [desk, setDesk] = useState("");
  const [serverError, setServerError] = useState("");
  const [serverTesting, setServerTesting] = useState(false);
  const [serverTestOk, setServerTestOk] = useState<boolean | null>(null);

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

  useEffect(() => {
    if (!isAdmin) return;
    api
      .settings()
      .then((s) => setEscalation(s.escalation_minutes))
      .catch(() => {});
  }, [isAdmin]);

  const testServer = async () => {
    setServerError("");
    setServerTestOk(null);
    if (!isValidServerUrl(url)) {
      setServerError("Укажите корректный адрес: http:// или https://");
      return;
    }
    setServerTesting(true);
    try {
      const ok = await checkServerAt(url);
      setServerTestOk(ok);
      if (!ok) {
        setServerError("Сервер не отвечает. Проверьте адрес и что сервер запущен.");
      }
    } finally {
      setServerTesting(false);
    }
  };

  const save = async () => {
    setMsg("");
    setServerError("");

    const normalized = normalizeServerUrl(url);
    const serverChanged = isAdmin && normalized !== getServerUrl();

    if (isAdmin && !isValidServerUrl(url)) {
      setServerError("Укажите корректный адрес: http:// или https://");
      return;
    }

    saveLastLocation(row, desk);
    localStorage.setItem("quiet_start", quietStart);
    localStorage.setItem("quiet_end", quietEnd);

    if (isAdmin) {
      try {
        await api.updateSettings({
          escalation_minutes: escalation,
          quiet_hours_start: quietStart || null,
          quiet_hours_end: quietEnd || null,
        });
      } catch (e) {
        setServerError(e instanceof Error ? e.message : String(e));
        onServerSaved?.(false);
        return;
      }
    }

    if (serverChanged) {
      const ok = await checkServerAt(normalized);
      if (!ok) {
        setServerError(
          "Новый сервер недоступен. Проверьте адрес или нажмите «Проверить подключение».",
        );
        onServerSaved?.(false);
        return;
      }
      setServerUrl(normalized);
      setUrl(normalized);
      onServerSaved?.(true);
      setMsg("Адрес сервера сохранён. Войдите в кабинет снова.");
      onLogout();
      return;
    }

    if (isAdmin) {
      setServerUrl(normalized);
    }

    const ok = await checkServerAt(getServerUrl());
    onServerSaved?.(ok);
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
      {serverError && <div className="error-banner">{serverError}</div>}
      {serverTestOk === true && !serverError && (
        <div className="success-banner">Сервер доступен.</div>
      )}

      <FormSection
        title="Подключение к серверу"
        hint={
          isAdmin
            ? "После переноса или обновления сервера укажите новый адрес (например https://192.168.1.50). Доступно только администратору."
            : "Меняйте только по указанию IT-отдела"
        }
      >
        <div className="form-row">
          <label>Адрес сервера</label>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setServerTestOk(null);
              setServerError("");
            }}
            placeholder={isAdmin ? "https://192.168.1.50" : "http://127.0.0.1:8080"}
            readOnly={!isAdmin}
            className={!isAdmin ? "input-readonly" : undefined}
          />
          {isAdmin ? (
            <div className="settings-server-actions">
              <button
                type="button"
                className="btn"
                onClick={() => void testServer()}
                disabled={serverTesting || !url.trim()}
              >
                {serverTesting ? "Проверка…" : "Проверить подключение"}
              </button>
              <p className="hint">
                Текущий сохранённый адрес: <strong>{getServerUrl()}</strong>
              </p>
              <p className="hint">
                При смене адреса сессия администратора сбрасывается — потребуется войти снова.
              </p>
            </div>
          ) : (
            <p className="hint">
              Адрес задаётся администратором. Текущий: <strong>{getServerUrl()}</strong>
            </p>
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
        <button className="btn btn-primary" onClick={() => void save()}>
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
