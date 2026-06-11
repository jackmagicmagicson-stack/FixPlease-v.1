import { useEffect, useState } from "react";
import { getAdminProfile } from "./adminSession";
import { api, getAdminToken, setAdminToken } from "./api";
import { checkForUpdates } from "./updater";
import { AppHeader } from "./components/AppHeader";
import { useEmployeeStatus } from "./components/EmployeeStatusProvider";
import { GlassPageTransition } from "./components/GlassPageTransition";
import { useInterfacePrefs } from "./components/InterfacePrefsProvider";
import { Toast, type ToastData } from "./components/Toast";
import { WelcomeOnboarding } from "./components/WelcomeOnboarding";
import { WindowTitleBar } from "./components/WindowTitleBar";
import { isOnboardingDone } from "./onboardingState";
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

export default function App() {
  const [mode, setMode] = useState<"employee" | "admin">("employee");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminProfile, setAdminProfileState] = useState(() => getAdminProfile());
  const [employeeTab, setEmployeeTab] = useState<EmployeeTab>("create");
  const [adminTab, setAdminTab] = useState<AdminTab>("queue");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [versionBlocked, setVersionBlocked] = useState(false);
  const [serverOk, setServerOk] = useState(true);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [updateMsg, setUpdateMsg] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(
    () => mode === "employee" && !isOnboardingDone(),
  );

  const { prefs } = useInterfacePrefs();
  const { activeTicket, unreadCount, refresh: refreshEmployeeStatus } = useEmployeeStatus();
  const employeeUx = prefs.employeeUxEnhanced;

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

      api
        .health()
        .then(() => {
          if (!cancelled) setServerOk(true);
        })
        .catch(() => {
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
      setAdminProfileState(null);
      return;
    }
    api.validateAdminSession().then((ok) => {
      setAdminAuthed(ok);
      setAdminProfileState(ok ? getAdminProfile() : null);
    });
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
    const onUnauthorized = () => {
      setAdminAuthed(false);
      setAdminProfileState(null);
    };
    window.addEventListener("fixplease-admin-unauthorized", onUnauthorized);
    return () => window.removeEventListener("fixplease-admin-unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    const showOnboardingAgain = () => setShowOnboarding(true);
    window.addEventListener("fixplease-show-onboarding", showOnboardingAgain);
    return () => window.removeEventListener("fixplease-show-onboarding", showOnboardingAgain);
  }, []);

  useEffect(() => {
    const onToast = (ev: Event) => {
      const detail = (ev as CustomEvent<{ message: string }>).detail;
      if (detail?.message) {
        setToast({ message: detail.message });
      }
    };
    window.addEventListener("fixplease-toast", onToast);
    return () => window.removeEventListener("fixplease-toast", onToast);
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
    setAdminProfileState(null);
    setMode("employee");
    setSettingsOpen(false);
    setSelectedTicket(null);
  };

  if (versionBlocked) {
    return (
      <div className="app-window">
        <div className="app-chrome">
          <WindowTitleBar />
        </div>
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
    <div className="app-window">
      <div className="app-chrome">
        <WindowTitleBar />
        <div className="app-chrome-inner">
          <AppHeader
            mode={mode}
            modeLabel={modeLabel}
            serverOk={serverOk}
            settingsOpen={settingsOpen}
            adminAuthed={adminAuthed}
            adminDisplayName={adminProfile?.display_name}
            employeeTab={employeeTab}
            adminTab={adminTab}
            queueCount={queueCount}
            employeeUxEnhanced={mode === "employee" && employeeUx}
            activeTicket={mode === "employee" && employeeUx ? activeTicket : null}
            unreadCount={unreadCount}
            onActiveTicketClick={() => {
              setEmployeeTab("track");
              setSettingsOpen(false);
            }}
            onEmployeeTab={(tab) => {
              setEmployeeTab(tab);
              setSettingsOpen(false);
            }}
            onAdminTab={(tab) => {
              setAdminTab(tab);
              setSettingsOpen(false);
              if (tab !== "queue") setSelectedTicket(null);
            }}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenAdmin={openAdminCabinet}
            onSwitchEmployee={switchToEmployee}
          />

          {!serverOk && (
            <div className="error-banner banner-enter">
              Не удалось подключиться к серверу. Откройте «Настройки» в шапке и проверьте адрес
              сервера.
            </div>
          )}
        </div>
      </div>

      <div className="app-shell">
      <main className="app-main">
        <GlassPageTransition pageKey={pageKey}>
          {mode === "employee" && settingsOpen && (
            <Settings
              isAdmin={false}
              allowServerSetup={!serverOk}
              onLogout={() => {}}
              onServerSaved={setServerOk}
            />
          )}

          {mode === "employee" && !settingsOpen && employeeTab === "create" && (
            <CreateTicket
              onToast={setToast}
              onCreated={() => {
                setEmployeeTab("track");
                refreshEmployeeStatus();
              }}
            />
          )}

          {mode === "employee" && !settingsOpen && employeeTab === "track" && (
            <TrackTicket onCreateTicket={() => setEmployeeTab("create")} />
          )}

          {mode === "admin" && !adminAuthed && settingsOpen && (
            <Settings
              isAdmin={false}
              allowServerSetup
              onLogout={() => {}}
              onServerSaved={setServerOk}
            />
          )}

          {mode === "admin" && !adminAuthed && !settingsOpen && (
            <AdminLogin
              onSuccess={() => {
                setAdminAuthed(true);
                setAdminProfileState(getAdminProfile());
              }}
            />
          )}

          {mode === "admin" && adminAuthed && settingsOpen && (
            <Settings
              isAdmin
              isSuperAdmin={adminProfile?.is_super_admin}
              adminId={adminProfile?.admin_id}
              onServerSaved={setServerOk}
              onLogout={() => {
                setAdminAuthed(false);
                setAdminToken(null);
                setAdminProfileState(null);
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

      {toast && (
        <Toast
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onDismiss={() => setToast(null)}
        />
      )}

      {showOnboarding && mode === "employee" && !versionBlocked && (
        <WelcomeOnboarding onComplete={() => setShowOnboarding(false)} />
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
