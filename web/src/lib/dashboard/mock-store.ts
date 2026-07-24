import { browser } from "$app/environment";
import { writable } from "svelte/store";
import { createSeedState } from "./fixtures";
import type { DashboardState } from "./types";

const LOCAL_STORAGE_KEY = "wall-matrix-panel.mock-dashboard";

function isDashboardState(value: unknown): value is DashboardState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DashboardState>;
  return (
    Array.isArray(candidate.cards) &&
    Array.isArray(candidate.devices) &&
    Array.isArray(candidate.firmware) &&
    Array.isArray(candidate.rules) &&
    Array.isArray(candidate.scenes) &&
    Array.isArray(candidate.sources) &&
    !!candidate.telemetry &&
    typeof candidate.telemetry === "object"
  );
}

export const mockState = writable<DashboardState>(createSeedState());

function hydrateMockState(): void {
  const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!cached) {
    return;
  }

  try {
    const parsed = JSON.parse(cached) as unknown;
    if (isDashboardState(parsed)) {
      mockState.set(parsed);
      return;
    }
  } catch {
    // Ignore invalid mock cache and reset below.
  }

  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

if (browser) {
  hydrateMockState();
  mockState.subscribe((state) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  });
}

export function resetMockState(): void {
  mockState.set(createSeedState());
}
