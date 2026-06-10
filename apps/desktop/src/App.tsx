import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ClipboardList,
  Inbox,
  PlusCircle,
  Settings as SettingsIcon,
  Shield,
} from "lucide-react";
import { api, getAdminToken, setAdminToken } from "./api";
import { checkForUpdates } from "./updater";
import { AppLogo } from "./components/AppLogo";
import { ConnectionBadge } from "./components/ConnectionBadge";
import { GlassPageTransition } from "./components/GlassPageTransition";
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

function NavButton({
  active,
  icon: Icon,
  label,
  onClick,
  ghost,
}: {
  active?: boolean;
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  ghost?: boolean;
}) {
  return (
    <button
      type="button"
      className={`nav-btn${active ? " active" : ""}${ghost ? " btn-ghost" : ""}`}
      onClick={onClick}
    >
      {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
      <span>{label}</span>
    </button>
  );
}

export default function App() {
  const [mode, setMode] = useState<"employee" | "admin">("employee");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [employeeTab, setEmployeeTab] = useState<EmployeeTab>("create");
  const [adminTab, setAdminTab] = useState<AdminTab>("queue");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [versionBlocked, setVersionBlocked] = useState(false);
  const [serverOk, setServerOk] = useState(true);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [updateMsg, setUpdateMsg] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refreshConnection = () => {
      api
        .version()
        .then((v) => {
          if (cancelled) return;
          if (compareSemver(__APP_VERSION__, v.min_client_version) < 0) {
            setVersionBlocked(true);
          }
          setServerOk(true);
        })
        .catch(() => {
          if (!cancelled) setServerOk(false);
        });

      api.health().catch(() => {
        if (!cancelled) setServerOk(false);
      });
    };

    refreshConnection();
    const onUrlChange = () => refreshConnection();
    window.addEventListener("fixplease-server-url-changed", onUrlChange);
    return () => {
      cancelled = true;
      window.removeEventListener("fixplease-server-url-changed", onUrlChange);
    };
  }, []);

  useEffect(() => {
    if (mode !== "admin") return;
    if (!getAdminToken()) {
      setAdminAuthed(false);
      return;
    }
    api.validateAdminSession().then(setAdminAuthed);
  }, [mode]);

  useEffect(() => {
    if (mode !== "admin" || !adminAuthed) {
      setQueueCount(null);
      return;
    }
    const refreshCount = () => {
      api
        .tickets({ sort: "importance" })
        .then((list) => setQueueCount(list.filter((t) => t.status !== "closed").length))
        .catch(() => setQueueCount(null));
    };
    refreshCount();
    return subscribe((ev) => {
      if (
        ev.type === "ticket_created" ||
        ev.type === "ticket_updated" ||
        ev.type === "ticket_escalated"
      ) {
        refreshCount();
      }
    });
  }, [mode, adminAuthed]);

  useEffect(() => {
    const isAdmin = mode === "admin" && adminAuthed;
    return subscribe((ev) => notifyWsEvent(ev, isAdmin));
  }, [mode, adminAuthed]);

  useEffect(() => {
    const onUnauthorized = () => setAdminAuthed(false);
    window.addEventListener("fixplease-admin-unauthorized", onUnauthorized);
    return () => window.removeEventListener("fixplease-admin-unauthorized", onUnauthorized);
  }, []);

  const openAdminCabinet = () => {
    setMode("admin");
    setSettingsOpen(false);
    setSelectedTicket(null);
    if (!getAdminToken()) {
      setAdminAuthed(false);
    }
  };

  const switchToEmployee = () => {
    setAdminToken(null);
    setAdminAuthed(false);
    setMode("employee");
    setSettingsOpen(false);
    setSelectedTicket(null);
  };

  if (versionBlocked) {
    return (
      <div className="app-shell">
        <div className="card page-card" style={{ margin: "2rem auto", maxWidth: 480 }}>
          <h2>Требуется обновление</h2>
          <p className="hint">
            Установлена версия {__APP_VERSION__}. Сервер требует более новый клиент.
          </p>
          {updateMsg && <div className="info-banner">{updateMsg}</div>}
          <div className="action-bar action-bar-primary">
            <button
              type="button"
              className="btn btn-primary"
              disabled={updateLoading}
              onClick={async () => {
                setUpdateLoading(true);
                setUpdateMsg("");
                try {
                  setUpdateMsg(await checkForUpdates());
                } catch (e) {
                  setUpdateMsg(e instanceof Error ? e.message : String(e));
                } finally {
                  setUpdateLoading(false);
                }
              }}
            >
              {updateLoading ? "Проверка…" : "Проверить обновления"}
            </button>
            <a
              className="btn"
              href="https://github.com/jackmagicmagicson-stack/FixPlease-v.1/releases"
              target="_blank"
              rel="noreferrer"
            >
              Скачать вручную
            </a>
          </div>
        </div>
      </div>
    );
  }

  const modeLabel = mode === "employee" ? "Сотрудник" : "Администратор";

  const pageKey = settingsOpen
    ? `settings-${mode}`
    : mode === "employee"
      ? `employee-${employeeTab}`
      : !adminAuthed
        ? "admin-login"
        : `admin-${adminTab}`;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <AppLogo />
          <span className="mode-badge">{modeLabel}</span>
          <ConnectionBadge ok={serverOk} />
        </div>

        <nav className="nav-primary" aria-label="Основные разделы">
          {mode === "employee" && (
            <>
              <NavButton
                active={employeeTab === "create" && !settingsOpen}
                icon={PlusCircle}
                label="Новая заявка"
                onClick={() => {
                  setEmployeeTab("create");
                  setSettingsOpen(false);
                }}
              />
              <NavButton
                active={employeeTab === "track" && !settingsOpen}
                icon={ClipboardList}
                label="Мои заявки"
                onClick={() => {
                  setEmployeeTab("track");
                  setSettingsOpen(false);
                }}
              />
            </>
          )}

          {mode === "admin" && adminAuthed && (
            <>
              <NavButton
                active={adminTab === "queue" && !settingsOpen}
                icon={Inbox}
                label={
                  queueCount != null && queueCount > 0 ? `Очередь (${queueCount})` : "Очередь"
                }
                onClick={() => {
                  setAdminTab("queue");
                  setSettingsOpen(false);
                }}
              />
              <NavButton
                active={adminTab === "reference" && !settingsOpen}
                icon={BookOpen}
                label="Справочник"
                onClick={() => {
                  setAdminTab("reference");
                  setSettingsOpen(false);
                  setSelectedTicket(null);
                }}
              />
              <NavButton
                active={adminTab === "reports" && !settingsOpen}
                icon={BarChart3}
                label="Отчёты"
                onClick={() => {
                  setAdminTab("reports");
                  setSettingsOpen(false);
                }}
              />
            </>
          )}
        </nav>

        <nav className="nav-secondary" aria-label="Дополнительно">
          {mode === "employee" && (
            <>
              <NavButton
                active={settingsOpen}
                icon={SettingsIcon}
                label="Настройки"
                onClick={() => setSettingsOpen(true)}
              />
              <NavButton ghost icon={Shield} label="Админ" onClick={openAdminCabinet} />
            </>
          )}

          {mode === "admin" && !adminAuthed && (
            <NavButton ghost icon={ArrowLeft} label="Сотрудник" onClick={switchToEmployee} />
          )}

          {mode === "admin" && adminAuthed && (
            <>
              <NavButton
                active={settingsOpen}
                icon={SettingsIcon}
                label="Настройки"
                onClick={() => setSettingsOpen(true)}
              />
              <NavButton ghost icon={ArrowLeft} label="Сотрудник" onClick={switchToEmployee} />
            </>
          )}
        </nav>
      </header>

      {!serverOk && (
        <div className="error-banner banner-enter">
          Не удалось подключиться к серверу. Откройте «Настройки» и проверьте адрес сервера.
        </div>
      )}

      <main className="app-main">
        <GlassPageTransition pageKey={pageKey}>
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

          {mode === "admin" && !adminAuthed && (
            <AdminLogin onSuccess={() => setAdminAuthed(true)} />
          )}

          {mode === "admin" && adminAuthed && settingsOpen && (
            <Settings
              isAdmin
              onLogout={() => {
                setAdminAuthed(false);
                setAdminToken(null);
              }}
            />
          )}

          {mode === "admin" && adminAuthed && !settingsOpen && (
            <>
              {adminTab === "queue" && (
                <div
                  className={`admin-workspace ${selectedTicket ? "admin-workspace-split" : "admin-workspace-single"}`}
                >
                  <div className="admin-panel admin-panel-list">
                    <AdminQueue
                      selectedId={selectedTicket?.id}
                      onSelect={setSelectedTicket}
                    />
                  </div>
                  {selectedTicket && (
                    <div className="admin-panel admin-panel-detail">
                      <TicketDetail
                        ticketId={selectedTicket.id}
                        onUpdated={(t) => {
                          if (t.status === "closed") {
                            setSelectedTicket(null);
                          } else {
                            setSelectedTicket(t);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              {adminTab === "reference" && <AdminCategories />}
              {adminTab === "reports" && <Stats />}
            </>
          )}
        </GlassPageTransition>
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
