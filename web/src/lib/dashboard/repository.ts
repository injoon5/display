import { compile } from "$lib/compiler";
import { get } from "svelte/store";
import {
  activateSceneLive,
  canUseLiveBackend,
  deployCardLive,
  hasLiveClient,
  pinCardLive,
  pokeLive,
  publishFirmwareLive,
  registerDeviceLive,
  saveCardLive,
  saveRuleLive,
  saveSceneLive,
  seedLiveDemo as seedLiveDemoLive,
  simulateTelemetryLive,
  unpinCardLive,
  writeSourceLive,
  dashboardStatus,
} from "./live-client";
import { mockState, resetMockState } from "./mock-store";
import type {
  ActivateSceneInput,
  DashboardCard,
  DashboardDevice,
  DashboardDiagnostic,
  DashboardFirmware,
  DashboardRule,
  DashboardScene,
  DashboardTelemetry,
  DeployCardResult,
  PinCardInput,
  PokeInput,
  PublishFirmwareInput,
  SaveCardInput,
  SaveRuleInput,
  SaveSceneInput,
  SimulateTelemetryInput,
  WriteSourceInput,
} from "./types";

function useLiveWrites(): boolean {
  return canUseLiveBackend();
}

function assertLiveReadyForSeed(): void {
  if (!hasLiveClient()) {
    return;
  }
  const status = get(dashboardStatus);
  if (status.mode === "degraded") {
    throw new Error(status.lastError ?? "Convex is degraded; fix the connection before seeding.");
  }
}

function mapDiagnostics(
  diagnostics: Array<{
    message: string;
    severity: string;
    span?: {
      start?: {
        column?: number;
        line?: number;
      };
    };
  }>,
): DashboardDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    col: diagnostic.span?.start?.column ?? 1,
    line: diagnostic.span?.start?.line ?? 1,
    message: diagnostic.message,
    severity: diagnostic.severity,
  }));
}

function resolveCardArtifacts(input: SaveCardInput): Pick<DashboardCard, "diagnostics" | "slotMap" | "sourceRefs"> {
  if (input.slotMap && input.diagnostics && input.sourceRefs) {
    return {
      diagnostics: input.diagnostics,
      slotMap: input.slotMap,
      sourceRefs: input.sourceRefs,
    };
  }

  const compiled = compile(input.source);
  return {
    diagnostics: input.diagnostics ?? mapDiagnostics(compiled.diagnostics),
    slotMap: input.slotMap ?? compiled.slotMap,
    sourceRefs: input.sourceRefs ?? compiled.sources,
  };
}

function upsert<T>(items: T[], next: T, key: (item: T) => string): T[] {
  const nextKey = key(next);
  const existingIndex = items.findIndex((item) => key(item) === nextKey);
  if (existingIndex === -1) {
    return [next, ...items];
  }

  const clone = [...items];
  clone[existingIndex] = next;
  return clone;
}

export { resetMockState };

export async function seedLiveDemo(): Promise<void> {
  if (hasLiveClient()) {
    assertLiveReadyForSeed();
    await seedLiveDemoLive();
    return;
  }

  resetMockState();
}

export async function saveCard(input: SaveCardInput): Promise<DashboardCard> {
  if (useLiveWrites()) {
    return await saveCardLive(input);
  }

  const nowMs = Date.now();
  const artifacts = resolveCardArtifacts(input);
  let savedCard: DashboardCard | null = null;

  mockState.update((state) => {
    const existing = state.cards.find((card) => card._id === input.cardId || card.slug === input.slug) ?? null;
    savedCard = {
      _creationTime: existing?._creationTime ?? nowMs,
      _id: existing?._id ?? input.cardId ?? `card-${input.slug}`,
      compiledStorageId: existing?.source === input.source ? existing.compiledStorageId : undefined,
      diagnostics: artifacts.diagnostics,
      dwellMs: input.dwellMs,
      enabled: input.enabled,
      estimatedAmps: input.estimatedAmps,
      name: input.name,
      priority: input.priority,
      slug: input.slug,
      slotMap: artifacts.slotMap,
      source: input.source,
      sourceRefs: artifacts.sourceRefs,
      updatedAt: nowMs,
    };

    return {
      ...state,
      cards: upsert(state.cards, savedCard, (card) => card._id),
    };
  });

  if (!savedCard) {
    throw new Error("Card save failed");
  }

  return savedCard;
}

export async function deployCard(
  cardIds: string[],
  deviceId: string,
  bytecode?: Uint8Array,
): Promise<DeployCardResult> {
  if (useLiveWrites()) {
    return await deployCardLive(cardIds, deviceId);
  }

  const etag = `"mock-${Date.now()}"`;
  mockState.update((state) => ({
    ...state,
    devices: state.devices.map((device) =>
      device._id === deviceId
        ? {
            ...device,
            programEtag: etag,
            programVersion: device.programVersion + 1,
          }
        : device,
    ),
  }));

  return {
    etag,
    size: bytecode?.length ?? cardIds.length,
  };
}

export async function saveScene(input: SaveSceneInput): Promise<void> {
  if (useLiveWrites()) {
    await saveSceneLive(input);
    return;
  }

  const nowMs = Date.now();
  const next: DashboardScene = {
    _creationTime: nowMs,
    _id: input.sceneId ?? `scene-${input.name}`,
    brightnessCeiling: input.brightnessCeiling,
    cardIds: input.cardIds,
    enabled: input.enabled,
    homekitIdentifier: input.homekitIdentifier,
    name: input.name,
    schedule: input.schedule,
  };

  mockState.update((state) => ({
    ...state,
    scenes: upsert(state.scenes, next, (scene) => scene._id),
  }));
}

export async function saveRule(input: SaveRuleInput): Promise<void> {
  if (useLiveWrites()) {
    await saveRuleLive(input);
    return;
  }

  const next: DashboardRule = {
    _creationTime: Date.now(),
    _id: input.ruleId ?? `rule-${input.name}`,
    action: input.action,
    condition: input.condition,
    enabled: input.enabled,
    name: input.name,
    priority: input.priority,
  };

  mockState.update((state) => ({
    ...state,
    rules: upsert(state.rules, next, (rule) => rule._id),
  }));
}

export async function writeSource(input: WriteSourceInput): Promise<void> {
  if (useLiveWrites()) {
    await writeSourceLive(input);
    return;
  }

  mockState.update((state) => ({
    ...state,
    sources: upsert(
      state.sources,
      {
        _creationTime: Date.now(),
        _id: `source-${input.sourceId}`,
        config: {},
        consecutiveFailures: 0,
        data: input.data,
        fetchedAt: Date.now(),
        intervalMs: input.intervalMs,
        kind: input.kind,
        origin: input.origin,
        sourceId: input.sourceId,
      },
      (source) => source.sourceId,
    ),
  }));
}

export async function publishFirmware(input: PublishFirmwareInput): Promise<void> {
  if (useLiveWrites()) {
    await publishFirmwareLive(input);
    return;
  }

  const next: DashboardFirmware = {
    _creationTime: Date.now(),
    _id: `fw-${input.version}`,
    channel: input.channel,
    r2Url: input.r2Url,
    releasedAt: Date.now(),
    sha256: input.sha256,
    signature: input.signature,
    version: input.version,
  };

  mockState.update((state) => ({
    ...state,
    firmware: [next, ...state.firmware],
  }));
}

export async function pinCard(input: PinCardInput): Promise<DashboardDevice> {
  if (useLiveWrites()) {
    return await pinCardLive(input);
  }

  let updated: DashboardDevice | null = null;
  mockState.update((state) => {
    const devices = state.devices.map((device) => {
      if (device._id !== input.deviceId) return device;
      updated = {
        ...device,
        dataVersion: device.dataVersion + 1,
        pinnedCardId: input.cardId,
        pinnedUntil: Date.now() + (input.durationMs ?? 60_000),
      };
      return updated;
    });
    return { ...state, devices };
  });

  if (!updated) throw new Error("Device not found");
  return updated;
}

export async function unpinCard(deviceId: string): Promise<DashboardDevice> {
  if (useLiveWrites()) {
    return await unpinCardLive(deviceId);
  }

  let updated: DashboardDevice | null = null;
  mockState.update((state) => {
    const devices = state.devices.map((device) => {
      if (device._id !== deviceId) return device;
      updated = {
        ...device,
        dataVersion: device.dataVersion + 1,
        pinnedCardId: undefined,
        pinnedUntil: undefined,
      };
      return updated;
    });
    return { ...state, devices };
  });

  if (!updated) throw new Error("Device not found");
  return updated;
}

export async function activateScene(input: ActivateSceneInput): Promise<DashboardDevice> {
  if (useLiveWrites()) {
    return await activateSceneLive(input);
  }

  let updated: DashboardDevice | null = null;
  mockState.update((state) => {
    const scene = state.scenes.find((entry) => entry._id === input.sceneId);
    if (!scene) throw new Error("Scene not found");

    const devices = state.devices.map((device) => {
      if (device._id !== input.deviceId) return device;
      updated = {
        ...device,
        activeSceneId: input.sceneId,
        brightnessCeiling: scene.brightnessCeiling,
        dataVersion: device.dataVersion + 1,
        pinnedCardId: undefined,
        pinnedUntil: undefined,
        playlistCardIds: scene.cardIds,
      };
      return updated;
    });
    return { ...state, devices };
  });

  if (!updated) throw new Error("Device not found");
  return updated;
}

export async function registerDevice(input: {
  name: string;
  token: string;
  fwVersion: string;
  fwChannel: "dev" | "stable";
}): Promise<DashboardDevice> {
  if (useLiveWrites()) {
    return await registerDeviceLive(input);
  }

  const now = Date.now();
  const created: DashboardDevice = {
    _creationTime: now,
    _id: `device-${now}`,
    brightnessCeiling: 100,
    dataEtag: `"mock-data-${now}"`,
    dataVersion: 0,
    fwChannel: input.fwChannel,
    fwVersion: input.fwVersion,
    lastSeen: now,
    name: input.name,
    online: true,
    programEtag: `"mock-program-${now}"`,
    programVersion: 0,
    tokenHash: `mock:${input.token}`,
  };

  mockState.update((state) => {
    const existing = state.devices.find((device) => device.tokenHash === created.tokenHash);
    if (existing) {
      const devices = state.devices.map((device) =>
        device._id === existing._id
          ? {
              ...device,
              fwChannel: input.fwChannel,
              fwVersion: input.fwVersion,
              lastSeen: now,
              name: input.name,
              online: true,
            }
          : device,
      );
      return { ...state, devices };
    }
    return { ...state, devices: [created, ...state.devices] };
  });

  const state = get(mockState);
  return state.devices.find((device) => device.name === input.name && device.lastSeen === now) ?? created;
}

export async function simulateTelemetry(input: SimulateTelemetryInput): Promise<DashboardTelemetry> {
  if (useLiveWrites()) {
    return await simulateTelemetryLive(input);
  }

  let next: DashboardTelemetry | null = null;
  mockState.update((state) => {
    next = {
      ...state.telemetry,
      at: Date.now(),
      brightness: input.brightness ?? state.telemetry.brightness,
      estAmps: input.estAmps ?? state.telemetry.estAmps,
      lux: input.lux ?? state.telemetry.lux,
      presenceRoom: input.presenceRoom ?? state.telemetry.presenceRoom,
    };
    return {
      ...state,
      devices: state.devices.map((device) =>
        device._id === input.deviceId
          ? { ...device, lastSeen: Date.now(), online: true }
          : device,
      ),
      telemetry: next,
    };
  });

  if (!next) throw new Error("Telemetry simulate failed");
  return next;
}

export async function poke(input: PokeInput): Promise<void> {
  if (useLiveWrites()) {
    await pokeLive(input);
    return;
  }

  await writeSource({
    data: {
      message: input.message.trim(),
      updatedAt: new Date().toISOString(),
    },
    intervalMs: 60_000,
    kind: "local.poke",
    origin: "convex",
    sourceId: "poke",
  });

  let selfStatusId: string | null = null;
  mockState.update((state) => {
    selfStatusId = state.cards.find((card) => card.slug === "self-status")?._id ?? null;
    return state;
  });

  if (selfStatusId) {
    await pinCard({
      cardId: selfStatusId,
      deviceId: input.deviceId,
      durationMs: input.durationMs ?? 10_000,
    });
  }
}
