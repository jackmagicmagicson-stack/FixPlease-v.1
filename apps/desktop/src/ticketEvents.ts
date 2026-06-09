export const TICKETS_CHANGED = "fixplease-tickets-changed";

export function notifyTicketsChanged() {
  window.dispatchEvent(new CustomEvent(TICKETS_CHANGED));
}
