export interface AdminProfile {
  admin_id: string;
  display_name: string;
  is_super_admin: boolean;
}

const PROFILE_KEY = "admin_profile";

export function setAdminProfile(profile: AdminProfile | null) {
  if (profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(PROFILE_KEY);
  }
}

export function getAdminProfile(): AdminProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminProfile;
  } catch {
    return null;
  }
}
