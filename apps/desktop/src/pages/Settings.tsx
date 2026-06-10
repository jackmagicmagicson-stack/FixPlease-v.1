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
import { checkForUpdates } from "../updater";

interface Props {
  isAdmin: boolean;
  onLogout: () => void;
}

export function Settings({ isAdmin, onLogout }: Props) {
  const [url, setUrl] = useState(getServerUrl());
  const [row, setRow] = useState("");
  const [desk, setDesk] = useState("");
  const [quietStart, setQuietStart] = useState(localStorage.getItem("quiet_start") || "");
  const [quietEnd, setQuietEnd] = useState(localStorage.getItem("quiet_end") || "");
  const [escalation, setEscalation] = useState(15);
  const [minClientVersion, setMinClientVersion] = useState("0.1.0");
  const [updateVersion, setUpdateVersion] = useState("");
  const [updateUrl, setUpdateUrl] = useState("");
  const [updateSignature, setUpdateSignature] = useState("");
  const [msg, setMsg] = useState("");
  const [updateMsg, setUpdateMsg] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);

  useEffect(() => {
    setUrl(getServerUrl());
    const loc = getLastLocation();
    setRow(loc.row);
    setDesk(loc.desk);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .settings()
      .then((s) => {
        setEscalation(s.escalation_minutes);
        setMinClientVersion(s.min_client_version);
        setUpdateVersion(s.client_update_version || "");
        setUpdateUrl(s.client_update_url || "");
        setUpdateSignature(s.client_update_signature || "");
      })
      .catch(() => {});
  }, [isAdmin]);

  const save = async () => {
    setServerUrl(url);
    saveLastLocation(row, desk);
    localStorage.setItem("quiet_start", quietStart);
    localStorage.setItem("quiet_end", quietEnd);
    if (isAdmin) {
      await api.updateSettings({
        escalation_minutes: escalation,
        min_client_version: minClientVersion,
        client_update_version: updateVersion || null,
        client_update_url: updateUrl || null,
        client_update_signature: updateSignature || null,
      });
    }
    setMsg("Сохранено");
  };

  const runUpdateCheck = async () => {
    setUpdateMsg("");
    setUpdateLoading(true);
    try {
      const result = await checkForUpdates();
      setUpdateMsg(result);
    } catch (e) {
      setUpdateMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <div className="card page-card">
      <PageHeader
        title="Настройки"
        lead={
          isAdmin
            ? "Подключение к серверу и параметры работы системы."
            : "Подключение к серверу и личные параметры."
        }
      />
      {msg && <div className="success-banner">{msg}</div>}
      {updateMsg && <div className="info-banner">{updateMsg}</div>}

      <FormSection
        title="Подключение к серверу"
        hint="Например https://192.168.1.50 или http://127.0.0.1:8080 для разработки"
      >
        <div className="form-row">
          <label>Адрес сервера</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://127.0.0.1:8080"
          />
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

      <FormSection title="Обновления приложения">
        <p className="hint">
          Проверка загружает манифест с сервера. Версия клиента: {__APP_VERSION__}
        </p>
        <button type="button" className="btn btn-primary" onClick={runUpdateCheck} disabled={updateLoading}>
          {updateLoading ? "Проверка…" : "Проверить обновления"}
        </button>
      </FormSection>

      {isAdmin && (
        <>
          <FormSection title="Параметры очереди" hint="Влияют на всех администраторов">
            <div className="form-row">
              <label>Эскалация (минут без ответа)</label>
              <input
                type="number"
                value={escalation}
                onChange={(e) => setEscalation(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="form-row">
              <label>Минимальная версия клиента</label>
              <input
                value={minClientVersion}
                onChange={(e) => setMinClientVersion(e.target.value)}
                placeholder="0.1.0"
              />
            </div>
          </FormSection>

          <FormSection
            title="Манифест обновления клиента"
            hint="После сборки релиза укажите версию, URL установщика и подпись из .sig файла"
          >
            <div className="form-row">
              <label>Версия обновления</label>
              <input
                value={updateVersion}
                onChange={(e) => setUpdateVersion(e.target.value)}
                placeholder="0.2.0"
              />
            </div>
            <div className="form-row">
              <label>URL установщика</label>
              <input
                value={updateUrl}
                onChange={(e) => setUpdateUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="form-row">
              <label>Подпись (.sig)</label>
              <textarea
                value={updateSignature}
                onChange={(e) => setUpdateSignature(e.target.value)}
                placeholder="Содержимое файла подписи"
                rows={4}
              />
            </div>
          </FormSection>
        </>
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
