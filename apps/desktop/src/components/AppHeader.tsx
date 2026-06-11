import type { LucideIcon } from "lucide-react";
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
import type { Ticket } from "../types";
import { ActiveTicketChip } from "./ActiveTicketChip";
import { AppLogo } from "./AppLogo";
import { ConnectionBadge } from "./ConnectionBadge";
import { ThemeToggle } from "./ThemeToggle";

type EmployeeTab = "create" | "track";
type AdminTab = "queue" | "reference" | "reports";

interface NavItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
  ghost?: boolean;
  badge?: number;
}

function NavButton({ item }: { item: NavItem }) {
  return (
    <button
      type="button"
      className={`nav-btn${item.active ? " active" : ""}${item.ghost ? " btn-ghost" : ""}`}
      onClick={item.onClick}
      data-nav-id={item.id}
    >
      {item.icon && <item.icon size={16} strokeWidth={2} aria-hidden />}
      <span>{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="nav-badge" aria-label={`${item.badge} новых`}>
          {item.badge}
        </span>
      )}
    </button>
  );
}

interface Props {
  mode: "employee" | "admin";
  modeLabel: string;
  serverOk: boolean;
  settingsOpen: boolean;
  adminAuthed: boolean;
  adminDisplayName?: string | null;
  employeeTab: EmployeeTab;
  adminTab: AdminTab;
  queueCount: number | null;
  employeeUxEnhanced?: boolean;
  activeTicket?: Ticket | null;
  unreadCount?: number;
  onEmployeeTab: (tab: EmployeeTab) => void;
  onAdminTab: (tab: AdminTab) => void;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  onSwitchEmployee: () => void;
  onActiveTicketClick?: () => void;
}

export function AppHeader({
  mode,
  modeLabel,
  serverOk,
  settingsOpen,
  adminAuthed,
  adminDisplayName,
  employeeTab,
  adminTab,
  queueCount,
  employeeUxEnhanced = false,
  activeTicket = null,
  unreadCount = 0,
  onEmployeeTab,
  onAdminTab,
  onOpenSettings,
  onOpenAdmin,
  onSwitchEmployee,
  onActiveTicketClick,
}: Props) {
  const primaryItems: NavItem[] = [];

  if (mode === "employee") {
    primaryItems.push(
      {
        id: "create",
        label: "Новая заявка",
        icon: PlusCircle,
        active: employeeTab === "create" && !settingsOpen,
        onClick: () => onEmployeeTab("create"),
      },
      {
        id: "track",
        label: "Мои заявки",
        icon: ClipboardList,
        active: employeeTab === "track" && !settingsOpen,
        onClick: () => onEmployeeTab("track"),
        badge: employeeUxEnhanced ? unreadCount : undefined,
      },
    );
  }

  if (mode === "admin" && adminAuthed) {
    primaryItems.push(
      {
        id: "queue",
        label: queueCount != null && queueCount > 0 ? `Очередь (${queueCount})` : "Очередь",
        icon: Inbox,
        active: adminTab === "queue" && !settingsOpen,
        onClick: () => onAdminTab("queue"),
      },
      {
        id: "reference",
        label: "Справочник",
        icon: BookOpen,
        active: adminTab === "reference" && !settingsOpen,
        onClick: () => onAdminTab("reference"),
      },
      {
        id: "reports",
        label: "Отчёты",
        icon: BarChart3,
        active: adminTab === "reports" && !settingsOpen,
        onClick: () => onAdminTab("reports"),
      },
    );
  }

  const secondaryItems: NavItem[] = [];

  if (mode === "employee") {
    secondaryItems.push(
      {
        id: "settings",
        label: "Настройки",
        icon: SettingsIcon,
        active: settingsOpen,
        onClick: onOpenSettings,
      },
      {
        id: "admin",
        label: "Админ",
        icon: Shield,
        active: false,
        onClick: onOpenAdmin,
        ghost: true,
      },
    );
  }

  if (mode === "admin" && !adminAuthed) {
    secondaryItems.push({
      id: "back-employee",
      label: "Сотрудник",
      icon: ArrowLeft,
      active: false,
      onClick: onSwitchEmployee,
      ghost: true,
    });
  }

  if (mode === "admin" && adminAuthed) {
    secondaryItems.push(
      {
        id: "settings",
        label: "Настройки",
        icon: SettingsIcon,
        active: settingsOpen,
        onClick: onOpenSettings,
      },
      {
        id: "back-employee",
        label: "Сотрудник",
        icon: ArrowLeft,
        active: false,
        onClick: onSwitchEmployee,
        ghost: true,
      },
    );
  }

  return (
    <header className="app-header">
      <div className="app-header-accent" aria-hidden />
      <div className="app-header-inner">
        <div className="app-brand">
          <AppLogo />
          <span className="mode-badge">{modeLabel}</span>
          {mode === "admin" && adminAuthed && adminDisplayName && (
            <span className="admin-session-badge">{adminDisplayName}</span>
          )}
          <ConnectionBadge ok={serverOk} />
          {employeeUxEnhanced && activeTicket && onActiveTicketClick && (
            <ActiveTicketChip
              ticket={activeTicket}
              unreadCount={unreadCount}
              onClick={onActiveTicketClick}
            />
          )}
        </div>

        {primaryItems.length > 0 && (
          <nav className="nav-primary" aria-label="Основные разделы">
            {primaryItems.map((item) => (
              <NavButton key={item.id} item={item} />
            ))}
          </nav>
        )}

        <div className="app-header-actions">
          {secondaryItems.length > 0 && (
            <nav className="nav-secondary" aria-label="Дополнительно">
              {secondaryItems.map((item) => (
                <NavButton key={item.id} item={item} />
              ))}
            </nav>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
