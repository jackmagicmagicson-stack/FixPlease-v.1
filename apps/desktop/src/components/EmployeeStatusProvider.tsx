import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api";
import { getLastReadAt, markTicketRead } from "../messageReadState";
import { getActiveHistoryEntries, upsertTicketHistory } from "../ticketHistory";
import { subscribe } from "../ws";
import type { Ticket, TicketMessage } from "../types";

interface EmployeeStatusContextValue {
  activeTicket: Ticket | null;
  unreadCount: number;
  refresh: () => void;
  markCurrentRead: (ticketId: string, messages: TicketMessage[]) => void;
}

const EmployeeStatusContext = createContext<EmployeeStatusContextValue | null>(null);

function countUnread(messages: TicketMessage[], ticketId: string): number {
  const lastRead = getLastReadAt(ticketId);
  return messages.filter(
    (m) => m.author_role === "admin" && (!lastRead || m.created_at > lastRead),
  ).length;
}

export function EmployeeStatusProvider({ children }: { children: ReactNode }) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    const active = getActiveHistoryEntries()[0];
    if (!active) {
      setActiveTicket(null);
      setUnreadCount(0);
      return;
    }
    try {
      const ticket = await api.ticket(active.id);
      upsertTicketHistory(ticket);
      if (ticket.status === "closed" || ticket.status === "draft") {
        setActiveTicket(null);
        setUnreadCount(0);
        return;
      }
      setActiveTicket(ticket);
      const messages = await api.messages(ticket.id);
      setUnreadCount(countUnread(messages, ticket.id));
    } catch {
      setActiveTicket(null);
      setUnreadCount(0);
    }
  }, []);

  const markCurrentRead = useCallback((ticketId: string, messages: TicketMessage[]) => {
    const adminMessages = messages.filter((m) => m.author_role === "admin");
    const latest = adminMessages[adminMessages.length - 1];
    if (latest) {
      markTicketRead(ticketId, latest.created_at);
    } else {
      markTicketRead(ticketId);
    }
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    refresh();
    return subscribe((ev) => {
      if (
        ev.type === "ticket_updated" ||
        ev.type === "message_created" ||
        ev.type === "ticket_created"
      ) {
        refresh();
      }
    });
  }, [refresh]);

  const value = useMemo(
    () => ({ activeTicket, unreadCount, refresh, markCurrentRead }),
    [activeTicket, unreadCount, refresh, markCurrentRead],
  );

  return (
    <EmployeeStatusContext.Provider value={value}>{children}</EmployeeStatusContext.Provider>
  );
}

export function useEmployeeStatus() {
  const ctx = useContext(EmployeeStatusContext);
  if (!ctx) throw new Error("useEmployeeStatus must be used within EmployeeStatusProvider");
  return ctx;
}
