const DRAFT_ID_KEY = "fixplease_draft_id";

export function getDraftId(): string | null {
  return localStorage.getItem(DRAFT_ID_KEY);
}

export function setDraftId(id: string) {
  localStorage.setItem(DRAFT_ID_KEY, id);
}

export function clearDraftId() {
  localStorage.removeItem(DRAFT_ID_KEY);
}
