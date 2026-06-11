const DONE_KEY = "fixplease_onboarding_done";

export function isOnboardingDone(): boolean {
  return localStorage.getItem(DONE_KEY) === "1";
}

export function setOnboardingDone() {
  localStorage.setItem(DONE_KEY, "1");
}

export function resetOnboarding() {
  localStorage.removeItem(DONE_KEY);
}
