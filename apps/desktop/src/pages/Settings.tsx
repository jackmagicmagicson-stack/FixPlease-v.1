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
import { useInterfacePrefs } from "../components/InterfacePrefsProvider";
import { PageHeader } from "../components/PageHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import {
  clearLastLocation,
  getLastLocation,
  hasSavedLocation,
  saveLastLocation,
} from "../locationMemory";
import { AboutProgram } from "../components/AboutProgram";
import { AdminManagement } from "../components/AdminManagement";
import { resetOnboarding } from "../onboardingState";
import { checkForUpdates } from "../updater";
import {
  applyAutostart,
  getAutostartPref,
  readAutostartEnabled,
  setAutostartPref,
} from "../autostart";

interface Props {
  isAdmin: boolean;
  /** Разрешить смену адреса без входа в админку (нет связи с сервером). */
  allowServerSetup?: boolean;
  isSuperAdmin?: boolean;
  adminId?: string;
  onLogout: () => void;
  onServerSaved?: (ok: boolean) => void;
}

export function Settings({
  isAdmin,
  allowServerSetup = false,
  isSuperAdmin = false,
  adminId,
  onLogout,
  onServerSaved,
}: Props) {
  const canEditServer = isAdmin || allowServerSetup;
  const {
    prefs,
    setTheme,
    setFontSize,
    setBlockSize,
    setPerformanceMode,
    setEmployeeUxEnhanced,
  } = useInterfacePrefs();
  const [url, setUrl] = useState(getServerUrl());
  const [row, setRow] = useState("");
  const [desk, setDesk] = useState("");
  const [serverError, setServerError] = useState("");
  const [serverTesting, setServerTesting] = useState(false);
  const [serverTestOk, setServerTestOk] = useState<boolean | null>(null);
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
  const [autostart, setAutostart] = useState(() => getAutostartPref());

  useEffect(() => {
    void readAutostartEnabled().then(setAutostart).catch(() => {});
  }, []);

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
    const serverChanged = canEditServer && normalized !== getServerUrl();

    if (canEditServer && !isValidServerUrl(url)) {
      setServerError("Укажите корректный адрес: http:// или https://");
      return;
    }

    saveLastLocation(row, desk);
    localStorage.setItem("quiet_start", quietStart);
    localStorage.setItem("quiet_end", quietEnd);
    setAutostartPref(autostart);
    try {
      await applyAutostart(autostart);
    } catch (e) {
      setServerError(
        e instanceof Error ? e.message : "Не удалось изменить автозапуск Windows",
      );
      onServerSaved?.(false);
      return;
    }

    if (isAdmin) {
      try {
        await api.updateSettings({
          escalation_minutes: escalation,
          min_client_version: minClientVersion,
          client_update_version: updateVersion || null,
          client_update_url: updateUrl || null,
          client_update_signature: updateSignature || null,
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
      if (isAdmin) {
        setMsg("Адрес сервера сохранён. Войдите в кабинет снова.");
        onLogout();
      } else {
        setMsg("Адрес сервера сохранён.");
      }
      return;
    }

    if (canEditServer) {
      setServerUrl(normalized);
    }

    const ok = await checkServerAt(getServerUrl());
    onServerSaved?.(ok);
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
            : "Обычно всё уже настроено IT-отделом при установке программы."
        }
      />
      {msg && <div className="success-banner">{msg}</div>}
      {serverError && <div className="error-banner">{serverError}</div>}
      {serverTestOk === true && !serverError && (
        <div className="success-banner">Сервер доступен.</div>
      )}
      {updateMsg && <div className="info-banner">{updateMsg}</div>}

      <FormSection
        title="Интерфейс"
        hint="Настройки применяются сразу и сохраняются на этом устройстве"
      >
        <div className="form-row">
          <label>Тема оформления</label>
          <SegmentedControl
            ariaLabel="Тема оформления"
            value={prefs.theme}
            onChange={setTheme}
            options={[
              { value: "light", label: "Светлая" },
              { value: "dark", label: "Тёмная" },
            ]}
          />
        </div>
        <div className="form-row">
          <label>Размер шрифта</label>
          <SegmentedControl
            ariaLabel="Размер шрифта"
            value={prefs.fontSize}
            onChange={setFontSize}
            options={[
              { value: "small", label: "Мелкий" },
              { value: "medium", label: "Обычный" },
              { value: "large", label: "Крупный" },
            ]}
          />
        </div>
        <div className="form-row">
          <label>Размер блоков</label>
          <SegmentedControl
            ariaLabel="Размер блоков"
            value={prefs.blockSize}
            onChange={setBlockSize}
            options={[
              { value: "compact", label: "Компактный" },
              { value: "comfortable", label: "Обычный" },
              { value: "spacious", label: "Просторный" },
            ]}
          />
        </div>
        <div className="form-row">
          <label>Режим производительности</label>
          <SegmentedControl
            ariaLabel="Режим производительности"
            value={prefs.performanceMode ? "on" : "off"}
            onChange={(v) => setPerformanceMode(v === "on")}
            options={[
              { value: "on", label: "Включён" },
              { value: "off", label: "Выключен" },
            ]}
          />
        </div>
        <p className="hint">
          Рекомендуется для слабых ПК: отключает анимации, эффект стекла и размытие — меньше
          нагрузка на процессор. При скрытии в трей фоновая активность снижается.
        </p>
        <div className="form-row">
          <label>Интерфейс сотрудника</label>
          <SegmentedControl
            ariaLabel="Интерфейс сотрудника"
            value={prefs.employeeUxEnhanced ? "enhanced" : "classic"}
            onChange={(v) => setEmployeeUxEnhanced(v === "enhanced")}
            options={[
              { value: "enhanced", label: "Новый" },
              { value: "classic", label: "Классический" },
            ]}
          />
        </div>
        <p className="hint">
          «Классический» откатывает шаги, липкие кнопки, виджет заявки в шапке и двухколоночный
          просмотр — без переустановки приложения.
        </p>
        <div className="form-row">
          <label>Приветствие</label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              resetOnboarding();
              window.dispatchEvent(new Event("fixplease-show-onboarding"));
            }}
          >
            Показать приветствие снова
          </button>
        </div>
      </FormSection>

      <FormSection
        title="Подключение к серверу"
        hint={
          isAdmin
            ? "После переноса или обновления сервера укажите новый адрес (например https://192.168.1.50). Доступно только администратору."
            : allowServerSetup
              ? "Сейчас нет связи с сервером — укажите адрес, который дал IT-отдел, и нажмите «Проверить подключение»."
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
            placeholder={canEditServer ? "https://192.168.1.50" : "http://127.0.0.1:8080"}
            readOnly={!canEditServer}
            className={!canEditServer ? "input-readonly" : undefined}
          />
          {canEditServer ? (
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

      <FormSection
        title="Запуск"
        hint="FixPlease может стартовать вместе с Windows и оставаться в трее"
      >
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={autostart}
            onChange={(e) => setAutostart(e.target.checked)}
          />
          Запускать FixPlease при входе в Windows
        </label>
      </FormSection>

      <FormSection title="Обновления приложения">
        <p className="hint">
          Проверка загружает манифест с сервера. Версия клиента: {__APP_VERSION__}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void runUpdateCheck()}
          disabled={updateLoading}
        >
          {updateLoading ? "Проверка…" : "Проверить обновления"}
        </button>
      </FormSection>

      {isAdmin && isSuperAdmin && adminId && (
        <AdminManagement currentAdminId={adminId} />
      )}

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

      <AboutProgram />

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
