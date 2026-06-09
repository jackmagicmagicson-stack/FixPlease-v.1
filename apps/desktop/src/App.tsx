import { useEffect, useState } from "react";
import { api, getAdminToken, setAdminToken } from "./api";
import { ConnectionBadge } from "./components/ConnectionBadge";
import { notifyWsEvent } from "./notify";
import { subscribe } from "./ws";
import { CreateTicket } from "./pages/CreateTicket";
import { TrackTicket } from "./pages/TrackTicket";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminQueue } from "./pages/AdminQueue";
import { TicketDetail } from "./pages/TicketDetail";
import { AdminCategories } from "./pages/AdminCategories";
import { Stats } from "./pages/Stats";
import { Settings } from "./pages/Settings";
import type { Ticket } from "./types";

type EmployeeTab = "create" | "track";
type AdminTab = "queue" | "reference" | "reports";

const APP_VERSION = "0.1.0";

export default function App() {
  const [mode, setMode] = useState<"employee" | "admin">("employee");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const [employeeTab, setEmployeeTab] = useState<EmployeeTab>("create");
  const [adminTab, setAdminTab] = useState<AdminTab>("queue");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [versionBlocked, setVersionBlocked] = useState(false);
  const [serverOk, setServerOk] = useState(true);

  useEffect(() => {
    api
      .version()
      .then((v) => {
        if (compareSemver(APP_VERSION, v.min_client_version) < 0) {
          setVersionBlocked(true);
        }
      })
      .catch(() => setServerOk(false));

    api.health().catch(() => setServerOk(false));
  }, []);

  useEffect(() => {
    const isAdmin = mode === "admin" && adminAuthed;
    return subscribe((ev) => notifyWsEvent(ev, isAdmin));
  }, [mode, adminAuthed]);

  useEffect(() => {
    const onUnauthorized = () => setAdminAuthed(false);
    window.addEventListener("fixplease-admin-unauthorized", onUnauthorized);
    return () => window.removeEventListener("fixplease-admin-unauthorized", onUnauthorized);
  }, []);

  const openAdminCabinet = async () => {
    setMode("admin");
    setSettingsOpen(false);
    if (!getAdminToken()) {
      setAdminAuthed(false);
      return;
    }
    setAdminChecking(true);
    const ok = await api.validateAdminSession();
    setAdminAuthed(ok);
    setAdminChecking(false);
  };

  const switchToEmployee = () => {
    setMode("employee");
    setSettingsOpen(false);
    setSelectedTicket(null);
  };

  if (versionBlocked) {
    return (
      <div className="app-shell">
        <div className="error-banner">
          Требуется обновление приложения. Нажмите «Проверить обновления» в настройках или
          переустановите клиент.
        </div>
      </div>
    );
  }

  const modeLabel = mode === "employee" ? "Сотрудник" : "Администратор";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <h1>FixPlease</h1>
          <span className="mode-badge">{modeLabel}</span>
          <ConnectionBadge ok={serverOk} />
        </div>

        <nav className="nav-primary" aria-label="Основные разделы">
          {mode === "employee" && (
            <>
              <button
                className={employeeTab === "create" && !settingsOpen ? "active" : ""}
                onClick={() => {
                  setEmployeeTab("create");
                  setSettingsOpen(false);
                }}
              >
                Новая заявка
              </button>
              <button
                className={employeeTab === "track" && !settingsOpen ? "active" : ""}
                onClick={() => {
                  setEmployeeTab("track");
                  setSettingsOpen(false);
                }}
              >
                Мои заявки
              </button>
            </>
          )}

          {mode === "admin" && adminAuthed && (
            <>
              <button
                className={adminTab === "queue" && !settingsOpen ? "active" : ""}
                onClick={() => {
                  setAdminTab("queue");
                  setSettingsOpen(false);
                }}
              >
                Очередь
              </button>
              <button
                className={adminTab === "reference" && !settingsOpen ? "active" : ""}
                onClick={() => {
                  setAdminTab("reference");
                  setSettingsOpen(false);
                  setSelectedTicket(null);
                }}
              >
                Справочник
              </button>
              <button
                className={adminTab === "reports" && !settingsOpen ? "active" : ""}
                onClick={() => {
                  setAdminTab("reports");
                  setSettingsOpen(false);
                }}
              >
                Отчёты
              </button>
            </>
          )}
        </nav>

        <nav className="nav-secondary" aria-label="Дополнительно">
          {mode === "employee" && (
            <>
              <button
                className={settingsOpen ? "active" : ""}
                onClick={() => setSettingsOpen(true)}
              >
                Настройки
              </button>
              <button className="btn-ghost" onClick={openAdminCabinet}>
                Админ
              </button>
            </>
          )}

          {mode === "admin" && !adminAuthed && !adminChecking && (
            <button className="btn-ghost" onClick={switchToEmployee}>
              ← Сотрудник
            </button>
          )}

          {mode === "admin" && adminAuthed && (
            <>
              <button
                className={settingsOpen ? "active" : ""}
                onClick={() => setSettingsOpen(true)}
              >
                Настройки
              </button>
              <button className="btn-ghost" onClick={switchToEmployee}>
                Сотрудник
              </button>
            </>
          )}
        </nav>
      </header>

      {!serverOk && (
        <div className="error-banner">
          Не удалось подключиться к серверу. Откройте «Настройки» и проверьте адрес сервера.
        </div>
      )}

      <main className="app-main">
        {mode === "employee" && settingsOpen && (
          <Settings isAdmin={false} onLogout={() => {}} />
        )}

        {mode === "employee" && !settingsOpen && employeeTab === "create" && (
          <CreateTicket
            onCreated={() => {
              setEmployeeTab("track");
            }}
          />
        )}

        {mode === "employee" && !settingsOpen && employeeTab === "track" && <TrackTicket />}

        {mode === "admin" && adminChecking && (
          <div className="card empty">Проверка сессии…</div>
        )}

        {mode === "admin" && !adminChecking && !adminAuthed && (
          <AdminLogin onSuccess={() => setAdminAuthed(true)} />
        )}

        {mode === "admin" && !adminChecking && adminAuthed && settingsOpen && (
          <Settings
            isAdmin
            onLogout={() => {
              setAdminAuthed(false);
              setAdminToken(null);
            }}
          />
        )}

        {mode === "admin" && !adminChecking && adminAuthed && !settingsOpen && (
          <>
            {adminTab === "queue" && (
              <div className="admin-workspace">
                <div className="admin-panel admin-panel-list">
                  <AdminQueue
                    selectedId={selectedTicket?.id}
                    onSelect={setSelectedTicket}
                  />
                </div>
                <div className="admin-panel admin-panel-detail">
                  <TicketDetail
                    ticketId={selectedTicket?.id ?? null}
                    onUpdated={(t) => {
                      if (t.status === "closed") {
                        setSelectedTicket(null);
                      } else {
                        setSelectedTicket(t);
                      }
                    }}
                  />
                </div>
              </div>
            )}
            {adminTab === "reference" && <AdminCategories />}
            {adminTab === "reports" && <Stats />}
          </>
        )}
      </main>
    </div>
  );
}

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}
