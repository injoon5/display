import { derived, get, type Readable } from "svelte/store";
import { liveState, dashboardStatus } from "./live-client";
import { mockState } from "./mock-store";
import {
  deployCard,
  publishFirmware,
  resetMockState,
  saveCard,
  saveRule,
  saveScene,
  seedLiveDemo,
  writeSource,
} from "./repository";
import { buildSlotSnapshot, resolvePath, setSlotSnapshotContext, sourceIdFromPath } from "./slot-snapshot";
import type {
  DashboardCard,
  DashboardDevice,
  DashboardDiagnostic,
  DashboardFirmware,
  DashboardRule,
  DashboardScene,
  DashboardSource,
  DashboardState,
  DashboardStatus,
  DashboardTelemetry,
  DeployCardResult,
  SlotSnapshot,
  SourceOrigin,
  SourceSlot,
} from "./types";

export const state: Readable<DashboardState> = derived(
  [mockState, liveState, dashboardStatus],
  ([$mockState, $liveState, $dashboardStatus]) =>
    $dashboardStatus.live && $liveState ? $liveState : $mockState,
);

export const cards = derived(state, ($state) => $state.cards);
export const devices = derived(state, ($state) => $state.devices);
export const scenes = derived(state, ($state) => $state.scenes);
export const rules = derived(state, ($state) => $state.rules);
export const sources = derived(state, ($state) => $state.sources);
export const firmware = derived(state, ($state) => $state.firmware);
export const telemetry = derived(state, ($state) => $state.telemetry);
export const primaryDevice = derived(devices, ($devices) => $devices[0] ?? null);

setSlotSnapshotContext({
  getPrimaryDevice: () => get(primaryDevice),
  getState: () => get(state),
});

export function getCardBySlug(slug: string): DashboardCard | null {
  return get(state).cards.find((card) => card.slug === slug) ?? null;
}

export function getActiveScene(device: DashboardDevice | null): DashboardScene | null {
  if (!device?.activeSceneId) {
    return null;
  }

  return get(state).scenes.find((scene) => scene._id === device.activeSceneId) ?? null;
}

export {
  buildSlotSnapshot,
  dashboardStatus,
  deployCard,
  publishFirmware,
  resetMockState,
  resolvePath,
  saveCard,
  saveRule,
  saveScene,
  seedLiveDemo,
  sourceIdFromPath,
  writeSource,
};

export type {
  DashboardCard,
  DashboardDevice,
  DashboardDiagnostic,
  DashboardFirmware,
  DashboardRule,
  DashboardScene,
  DashboardSource,
  DashboardState,
  DashboardStatus,
  DashboardTelemetry,
  DeployCardResult,
  SlotSnapshot,
  SourceOrigin,
  SourceSlot,
};
