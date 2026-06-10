import type {
  Attachment,
  Category,
  CategoryTemplate,
  StatsResponse,
  Ticket,
  TicketMessage,
} from "./types";
import { appFetch } from "./httpFetch";
import { disconnectWs } from "./ws";

const DEFAULT_SERVER_URL = "http://127.0.0.1:8080";

function readServerUrl(): string {
  const stored = localStorage.getItem("server_url");
  if (!stored || stored === "https://localhost") {
    return DEFAULT_SERVER_URL;
  }
  return stored;
}

let baseUrl = readServerUrl();
let adminToken: string | null = localStorage.getItem("admin_token");

export function setServerUrl(url: string) {
  const next = url.replace(/\/$/, "");
  if (next !== baseUrl) {
    disconnectWs();
    setAdminToken(null);
  }
  baseUrl = next;
  localStorage.setItem("server_url", baseUrl);
  window.dispatchEvent(new CustomEvent("fixplease-server-url-changed"));
}

export function getServerUrl() {
  return baseUrl;
}

export function setAdminToken(token: string | null) {
  adminToken = token;
  if (token) localStorage.setItem("admin_token", token);
  else localStorage.removeItem("admin_token");
}

export function getAdminToken() {
  return adminToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof Blob)) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    if (!adminToken) {
      throw new Error("Требуется вход в кабинет администратора");
    }
    headers.set("Authorization", `Bearer ${adminToken}`);
  }
  let res: Response;
  try {
    res = await appFetch(`${baseUrl}${path}`, { ...options, headers });
  } catch (e) {
    console.error("network error", e);
    throw new Error("Ошибка сети. Проверьте подключение к серверу.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: string }).error || res.statusText;
    if (res.status === 401 && auth) {
      setAdminToken(null);
      window.dispatchEvent(new CustomEvent("fixplease-admin-unauthorized"));
      throw new Error("Сессия истекла. Войдите в кабинет снова.");
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: async () => {
    const res = await appFetch(`${baseUrl}/health`);
    if (!res.ok) throw new Error(`server unreachable (${res.status})`);
    return res.text();
  },
  version: () =>
    request<{ min_client_version: string; api_version: string }>("/v1/version"),
  login: (password: string) =>
    request<{ token: string; admin_id: string; display_name: string }>(
      "/v1/auth/login",
      { method: "POST", body: JSON.stringify({ password }) },
    ),
  /** Проверяет, что сохранённый токен ещё действителен на текущем сервере. */
  validateAdminSession: async () => {
    if (!adminToken) return false;
    try {
      await request("/v1/settings", {}, true);
      return true;
    } catch {
      setAdminToken(null);
      return false;
    }
  },
  categories: () => request<Category[]>("/v1/categories"),
  templates: (categoryId: string) =>
    request<CategoryTemplate[]>(`/v1/categories/${categoryId}/templates`),
  createCategory: (name: string) =>
    request<Category>("/v1/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    }, true),
  createTemplate: (
    categoryId: string,
    data: { title: string; body: string; sort_order?: number },
  ) =>
    request<CategoryTemplate>(`/v1/categories/${categoryId}/templates`, {
      method: "POST",
      body: JSON.stringify(data),
    }, true),
  deleteTemplate: (id: string) =>
    request<void>(`/v1/templates/${id}`, { method: "DELETE" }, true),
  tickets: (params?: {
    status?: string;
    category_id?: string;
    sort?: "importance" | "newest" | "oldest";
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.category_id) q.set("category_id", params.category_id);
    if (params?.sort) q.set("sort", params.sort);
    const qs = q.toString();
    return request<Ticket[]>(`/v1/tickets${qs ? `?${qs}` : ""}`, {}, true);
  },
  ticket: (id: string) => request<Ticket>(`/v1/tickets/${id}`),
  ticketByNumber: (num: number) =>
    request<Ticket>(`/v1/tickets/by-number/${num}`),
  createTicket: (data: {
    row_label: string;
    desk_label: string;
    category_id?: string;
    description: string;
    save_as_draft?: boolean;
  }) =>
    request<Ticket>("/v1/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTicket: (id: string, data: Record<string, unknown>) =>
    request<Ticket>(`/v1/tickets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  submitTicket: (id: string) =>
    request<Ticket>(`/v1/tickets/${id}/submit`, { method: "POST" }),
  takeTicket: (id: string) =>
    request<Ticket>(`/v1/tickets/${id}/take`, { method: "POST" }, true),
  resolveTicket: (id: string) =>
    request<Ticket>(`/v1/tickets/${id}/resolve`, { method: "POST" }, true),
  closeTicket: (id: string, reason?: string) =>
    request<Ticket>(`/v1/tickets/${id}/close`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }, true),
  rejectTicket: (id: string, reason: string) =>
    request<Ticket>(`/v1/tickets/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }, true),
  purgeClosed: (mineOnly = true) =>
    request<{ deleted: number }>("/v1/tickets/purge-closed", {
      method: "POST",
      body: JSON.stringify({ mine_only: mineOnly }),
    }, true),
  messages: (ticketId: string) =>
    request<TicketMessage[]>(`/v1/tickets/${ticketId}/messages`),
  sendMessage: (ticketId: string, body: string, asAdmin = false) =>
    request<TicketMessage>(
      `/v1/tickets/${ticketId}/messages${asAdmin ? "/admin" : ""}`,
      { method: "POST", body: JSON.stringify({ body }) },
      asAdmin,
    ),
  attachments: (ticketId: string) =>
    request<Attachment[]>(`/v1/tickets/${ticketId}/attachments`),
  uploadAttachment: async (ticketId: string, file: File) => {
    const buf = await file.arrayBuffer();
    return request<Attachment>(`/v1/tickets/${ticketId}/attachments`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-Filename": file.name,
      },
      body: buf,
    });
  },
  attachmentUrl: (id: string) => `${baseUrl}/v1/attachments/${id}`,
  stats: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const qs = q.toString();
    return request<StatsResponse>(`/v1/stats${qs ? `?${qs}` : ""}`, {}, true);
  },
  settings: () =>
    request<{
      escalation_minutes: number;
      quiet_hours_start: string | null;
      quiet_hours_end: string | null;
      min_client_version: string;
      retention_days: number;
      client_update_version: string | null;
      client_update_url: string | null;
      client_update_signature: string | null;
    }>("/v1/settings"),
  updateSettings: (data: Record<string, unknown>) =>
    request("/v1/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }, true),
};

export function wsUrl(): string {
  const u = new URL(baseUrl);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return `${u.origin}/v1/ws`;
}
