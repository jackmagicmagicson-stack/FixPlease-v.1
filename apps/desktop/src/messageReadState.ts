const KEY = "fixplease_message_read_at";

function loadMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, string>) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getLastReadAt(ticketId: string): string | null {
  return loadMap()[ticketId] ?? null;
}

export function markTicketRead(ticketId: string, at = new Date().toISOString()) {
  const map = loadMap();
  map[ticketId] = at;
  saveMap(map);
}
