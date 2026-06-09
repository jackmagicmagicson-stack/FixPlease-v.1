const ROW_KEY = "fixplease_last_row";
const DESK_KEY = "fixplease_last_desk";
const REMEMBER_KEY = "fixplease_remember_location";

export function getLastLocation(): { row: string; desk: string } {
  return {
    row: localStorage.getItem(ROW_KEY) || "",
    desk: localStorage.getItem(DESK_KEY) || "",
  };
}

export function saveLastLocation(row: string, desk: string) {
  if (row.trim()) localStorage.setItem(ROW_KEY, row.trim());
  if (desk.trim()) localStorage.setItem(DESK_KEY, desk.trim());
}

export function clearLastLocation() {
  localStorage.removeItem(ROW_KEY);
  localStorage.removeItem(DESK_KEY);
}

export function hasSavedLocation(): boolean {
  const { row, desk } = getLastLocation();
  return Boolean(row.trim() || desk.trim());
}

export function getRememberLocation(): boolean {
  const saved = localStorage.getItem(REMEMBER_KEY);
  if (saved === "0") return false;
  if (saved === "1") return true;
  return hasSavedLocation();
}

export function setRememberLocation(remember: boolean) {
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}
