import { useEffect, useState } from "react";
import { api, getAdminToken, setAdminToken } from "./api";
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

type EmployeeTab = "create" | "track" | "settings";
type AdminTab = "queue" | "categories" | "stats" | "settings";

const APP_VERSION = "0.1.0";

export default function App() {
  const [mode, setMode] = useState<"employee" | "admin">("employee");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const [employeeTab, setEmployeeTab] = useState<EmployeeTab>("create");
  const [adminTab, setAdminTab] = useState<AdminTab>("queue");
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
    if (!getAdminToken()) {
      setAdminAuthed(false);
      return;
    }
    setAdminChecking(true);
    const ok = await api.validateAdminSession();
    setAdminAuthed(ok);
    setAdminChecking(false);
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>FixPlease</h1>
        <nav className="tabs">
          {mode === "employee" ? (
            <>
              <button
                className={employeeTab === "create" ? "active" : ""}
                onClick={() => setEmployeeTab("create")}
              >
                Создать
              </button>
              <button
                className={employeeTab === "track" ? "active" : ""}
                onClick={() => setEmployeeTab("track")}
              >
                Статус
              </button>
              <button
                className={employeeTab === "settings" ? "active" : ""}
                onClick={() => setEmployeeTab("settings")}
              >
                Настройки
              </button>
              <button className="btn" onClick={openAdminCabinet}>
                Кабинет админа
              </button>
            </>
          ) : !adminAuthed ? (
            <button className="btn" onClick={() => setMode("employee")}>
              Назад
            </button>
          ) : (
            <>
              <button
                className={adminTab === "queue" ? "active" : ""}
                onClick={() => setAdminTab("queue")}
              >
                Очередь
              </button>
              <button
                className={adminTab === "categories" ? "active" : ""}
                onClick={() => setAdminTab("categories")}
              >
                Категории
              </button>
              <button
                className={adminTab === "stats" ? "active" : ""}
                onClick={() => setAdminTab("stats")}
              >
                Статистика
              </button>
              <button
                className={adminTab === "settings" ? "active" : ""}
                onClick={() => setAdminTab("settings")}
              >
                Настройки
              </button>
              <button className="btn" onClick={() => setMode("employee")}>
                Режим сотрудника
              </button>
            </>
          )}
        </nav>
      </header>

      {!serverOk && (
        <div className="error-banner">
          Не удалось подключиться к серверу. Проверьте URL в настройках.
        </div>
      )}

      {mode === "employee" && (
        <>
          {employeeTab === "create" && (
            <CreateTicket onCreated={() => setEmployeeTab("track")} />
          )}
          {employeeTab === "track" && <TrackTicket />}
          {employeeTab === "settings" && (
            <Settings isAdmin={false} onLogout={() => {}} />
          )}
        </>
      )}

      {mode === "admin" && adminChecking && (
        <div className="card empty">Проверка сессии...</div>
      )}

      {mode === "admin" && !adminChecking && !adminAuthed && (
        <AdminLogin onSuccess={() => setAdminAuthed(true)} />
      )}

      {mode === "admin" && !adminChecking && adminAuthed && (
        <>
          {adminTab === "queue" && (
            <>
              <AdminQueue
                selectedId={selectedTicket?.id}
                onSelect={setSelectedTicket}
              />
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
            </>
          )}
          {adminTab === "categories" && <AdminCategories />}
          {adminTab === "stats" && <Stats />}
          {adminTab === "settings" && (
            <Settings
              isAdmin
              onLogout={() => {
                setAdminAuthed(false);
                setAdminToken(null);
              }}
            />
          )}
        </>
      )}
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
