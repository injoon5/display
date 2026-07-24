import { browser } from "$app/environment";
import { env } from "$env/dynamic/public";
import type { SlotMapEntry } from "$lib/compiler";
import { api } from "../../../convex/_generated/api.js";
import { ConvexClient } from "convex/browser";
import { derived, get, writable, type Readable } from "svelte/store";

export type DashboardDiagnostic = {
  col: number;
  line: number;
  message: string;
  severity: string;
};

export type DashboardCard = {
  _creationTime: number;
  _id: string;
  compiledStorageId?: string;
  diagnostics: DashboardDiagnostic[];
  dwellMs: number;
  enabled: boolean;
  estimatedAmps: number;
  name: string;
  priority: number;
  slug: string;
  slotMap: SlotMapEntry[];
  source: string;
  sourceRefs: string[];
  updatedAt: number;
};

export type DashboardDevice = {
  _creationTime: number;
  _id: string;
  activeSceneId?: string;
  dataEtag: string;
  dataVersion: number;
  fwChannel: "dev" | "stable";
  fwVersion: string;
  lastSeen: number;
  name: string;
  online: boolean;
  pinnedCardId?: string;
  pinnedUntil?: number;
  programEtag: string;
  programVersion: number;
  tokenHash: string;
};

export type DashboardSource = {
  _creationTime: number;
  _id: string;
  circuitOpenUntil?: number;
  config: Record<string, unknown>;
  consecutiveFailures: number;
  data: Record<string, unknown>;
  error?: string;
  fetchedAt: number;
  intervalMs: number;
  kind: string;
  origin: "convex" | "fly-nrt" | "oracle-icn";
  sourceId: string;
};

export type DashboardScene = {
  _creationTime: number;
  _id: string;
  brightnessCeiling?: number;
  cardIds: string[];
  enabled: boolean;
  homekitIdentifier: number;
  name: string;
  schedule?: string;
};

export type DashboardRule = {
  _creationTime: number;
  _id: string;
  action: {
    cardId?: string;
    durationMs?: number;
    kind: string;
    sceneId?: string;
    value?: number;
  };
  condition: string;
  enabled: boolean;
  name: string;
  priority: number;
};

export type DashboardFirmware = {
  _creationTime: number;
  _id: string;
  channel: string;
  r2Url: string;
  releasedAt: number;
  sha256: string;
  signature: string;
  version: string;
};

export type DashboardTelemetry = {
  at: number;
  brightness: number;
  estAmps: number;
  governorActive: boolean;
  heapFree: number;
  humidity: number;
  lux: number;
  presenceBed: boolean;
  presenceRoom: boolean;
  rssi: number;
  tempC: number;
};

export type DashboardState = {
  cards: DashboardCard[];
  devices: DashboardDevice[];
  firmware: DashboardFirmware[];
  rules: DashboardRule[];
  scenes: DashboardScene[];
  sources: DashboardSource[];
  telemetry: DashboardTelemetry;
};

export type SourceSlot = {
  path: string;
  sourceId: string;
  type: string;
  updatedMs: number;
  value: unknown;
};

export type SlotSnapshot = {
  byIndex: Record<number, SourceSlot>;
  byPath: Record<string, SourceSlot>;
};

type SyncStatus = {
  lastError: string | null;
  live: boolean;
  mode: "degraded" | "live" | "mock";
};

const LOCAL_STORAGE_KEY = "wall-matrix-panel.mock-dashboard";
const liveState = writable<Partial<DashboardState>>({});
const mockState = writable<DashboardState>(createSeedState());
const syncStatus = writable<SyncStatus>({
  lastError: null,
  live: false,
  mode: "mock"
});

const convexUrl = (env.PUBLIC_CONVEX_URL ?? "").trim();
const client = browser && convexUrl ? new ConvexClient(convexUrl, { unsavedChangesWarning: false }) : null;
let subscriptionsStarted = false;

if (browser) {
  hydrateMockState();
  void startLiveSync();
  mockState.subscribe((state) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  });
}

export const state: Readable<DashboardState> = derived([mockState, liveState], ([$mockState, $liveState]) =>
  mergeDashboardState($mockState, $liveState)
);

export const cards = derived(state, ($state) => $state.cards);
export const devices = derived(state, ($state) => $state.devices);
export const scenes = derived(state, ($state) => $state.scenes);
export const rules = derived(state, ($state) => $state.rules);
export const sources = derived(state, ($state) => $state.sources);
export const firmware = derived(state, ($state) => $state.firmware);
export const telemetry = derived(state, ($state) => $state.telemetry);
export const primaryDevice = derived(devices, ($devices) => $devices[0] ?? null);
export const dashboardStatus = derived(syncStatus, ($status) => $status);

function createSeedState(): DashboardState {
  const now = Date.now();
  const cards: DashboardCard[] = [
    buildCard({
      estimatedAmps: 1.08,
      name: "Bus 402",
      priority: 90,
      slug: "bus-402",
      source: {
        elements: [
          { color: "#f59e0b", font: "3x5", op: "text", value: "402", x: 1, y: 2 },
          { bind: "bus.eta_min", color: "#ffffff", font: "5x7", op: "text", type: "number", x: 20, y: 2 },
          { color: "#ffffff", font: "5x7", op: "text", value: "분", x: 36, y: 2 },
          { bind: "bus.next_eta_min", color: "#8f9f8d", font: "3x5", op: "text", type: "number", x: 20, y: 12 },
          { bind: "bus.headsign", color: "#a3b2a0", font: "3x5", op: "text", type: "string", x: 1, y: 24 }
        ],
        id: "bus-402"
      }
    }),
    buildCard({
      estimatedAmps: 0.92,
      name: "Weather",
      slug: "weather",
      source: {
        elements: [
          { bind: "wx.tempC", color: "#ffffff", font: "5x7", op: "text", type: "number", x: 1, y: 2 },
          { color: "#ffffff", font: "5x7", op: "text", value: "C", x: 22, y: 2 },
          { bind: "wx.condition", color: "#8f9f8d", font: "3x5", op: "text", type: "string", x: 1, y: 14 }
        ],
        id: "weather"
      }
    }),
    buildCard({
      estimatedAmps: 0.86,
      name: "Air Quality",
      slug: "air",
      source: {
        elements: [
          { color: "#8f9f8d", font: "3x5", op: "text", value: "PM2.5", x: 1, y: 2 },
          { bind: "air.pm25", color: "#ffffff", font: "5x7", op: "text", type: "number", x: 1, y: 12 },
          { bind: "air.grade", color: "#8f9f8d", font: "3x5", op: "text", type: "string", x: 24, y: 12 }
        ],
        id: "air"
      }
    }),
    buildCard({
      estimatedAmps: 0.55,
      name: "Clock",
      slug: "clock",
      source: {
        elements: [
          { color: "#ffffff", font: "5x7", op: "text", value: "07:21", x: 4, y: 4 },
          { bind: "calendar.dateLabel", color: "#7a8678", font: "3x5", op: "text", type: "string", x: 4, y: 18 }
        ],
        id: "clock"
      }
    }),
    buildCard({
      estimatedAmps: 0.19,
      name: "Clock Dim",
      slug: "clock-dim",
      source: {
        elements: [{ color: "#5f665f", font: "5x7", op: "text", value: "07:21", x: 8, y: 10 }],
        id: "clock-dim"
      }
    }),
    buildCard({
      estimatedAmps: 0.78,
      name: "Indoor",
      slug: "indoor",
      source: {
        elements: [
          { bind: "indoor.tempC", color: "#ffffff", font: "5x7", op: "text", type: "number", x: 1, y: 2 },
          { color: "#ffffff", font: "5x7", op: "text", value: "C", x: 20, y: 2 },
          { bind: "indoor.humidity", color: "#8f9f8d", font: "3x5", op: "text", type: "number", x: 1, y: 14 },
          { color: "#8f9f8d", font: "3x5", op: "text", value: "%", x: 18, y: 14 }
        ],
        id: "indoor"
      }
    }),
    buildCard({
      estimatedAmps: 0.88,
      name: "Calendar Next",
      slug: "calendar-next",
      source: {
        elements: [
          { color: "#8f9f8d", font: "3x5", op: "text", value: "NEXT", x: 1, y: 2 },
          { bind: "calendar.next.title", color: "#ffffff", font: "3x5", op: "text", type: "string", x: 1, y: 10 },
          { bind: "calendar.next.startsAt", color: "#8f9f8d", font: "3x5", op: "text", type: "string", x: 1, y: 22 }
        ],
        id: "calendar-next"
      }
    }),
    buildCard({
      estimatedAmps: 0.94,
      name: "Self Status",
      slug: "self-status",
      source: {
        elements: [
          { color: "#8f9f8d", font: "3x5", op: "text", value: "RSSI", x: 1, y: 2 },
          { bind: "telemetry.rssi", color: "#ffffff", font: "3x5", op: "text", type: "number", x: 24, y: 2 },
          { color: "#8f9f8d", font: "3x5", op: "text", value: "PRG", x: 1, y: 12 },
          { bind: "device.programVersion", color: "#ffffff", font: "3x5", op: "text", type: "number", x: 24, y: 12 },
          { bind: "poke.message", color: "#ffffff", font: "3x5", op: "text", type: "string", x: 1, y: 24 }
        ],
        id: "self-status"
      }
    })
  ];

  const sceneByName = {
    away: "scene-away",
    day: "scene-day",
    evening: "scene-evening",
    morning: "scene-morning",
    night: "scene-night"
  } as const;

  return {
    cards,
    devices: [
      {
        _creationTime: now - 1000,
        _id: "device-demo",
        activeSceneId: sceneByName.day,
        dataEtag: "\"seed-data\"",
        dataVersion: 12,
        fwChannel: "stable",
        fwVersion: "1.4.2",
        lastSeen: now,
        name: "Wall Matrix Panel Demo",
        online: true,
        programEtag: "\"seed-program\"",
        programVersion: 7,
        tokenHash: "demo-token"
      }
    ],
    firmware: [
      {
        _creationTime: now - 10 * 24 * 60 * 60 * 1000,
        _id: "fw-1.4.2",
        channel: "stable",
        r2Url: "https://example.invalid/fw/matrix-1.4.2.bin",
        releasedAt: now - 10 * 24 * 60 * 60 * 1000,
        sha256: "f5d4384ce980dce2b70351f8e4dc5df1",
        signature: "ed25519:demo",
        version: "1.4.2"
      },
      {
        _creationTime: now - 3 * 24 * 60 * 60 * 1000,
        _id: "fw-1.5.0-rc1",
        channel: "dev",
        r2Url: "https://example.invalid/fw/matrix-1.5.0-rc1.bin",
        releasedAt: now - 3 * 24 * 60 * 60 * 1000,
        sha256: "65d4384ce980dce2b70351f8e4dc5cab",
        signature: "ed25519:demo",
        version: "1.5.0-rc1"
      }
    ],
    rules: [
      {
        _creationTime: now - 2000,
        _id: "rule-bus-urgent",
        action: { cardId: "card-bus-402", durationMs: 60_000, kind: "pin" },
        condition: "bus.urgent == true",
        enabled: true,
        name: "bus urgent",
        priority: 100
      },
      {
        _creationTime: now - 2000,
        _id: "rule-air-alert",
        action: { cardId: "card-air", durationMs: 45_000, kind: "interrupt" },
        condition: "air.alert == true",
        enabled: true,
        name: "air alert",
        priority: 95
      },
      {
        _creationTime: now - 2000,
        _id: "rule-night",
        action: { kind: "scene", sceneId: sceneByName.night },
        condition: "time.hour >= 22 or time.hour < 6",
        enabled: true,
        name: "sleep",
        priority: 70
      },
      {
        _creationTime: now - 2000,
        _id: "rule-away",
        action: { kind: "scene", sceneId: sceneByName.away },
        condition: "indoor.presenceRoom == false and time.hour >= 8",
        enabled: true,
        name: "room empty",
        priority: 60
      }
    ],
    scenes: [
      buildScene("scene-morning", "morning", ["card-bus-402", "card-weather", "card-calendar-next", "card-air"], 1, 90, "weekday 06:30-09:30"),
      buildScene("scene-day", "day", ["card-weather", "card-indoor", "card-calendar-next", "card-self-status"], 2, 100),
      buildScene("scene-evening", "evening", ["card-clock", "card-weather", "card-indoor", "card-self-status"], 3, 65),
      buildScene("scene-night", "night", ["card-clock-dim"], 4, 15, "everyday 22:00-23:59"),
      buildScene("scene-away", "away", ["card-self-status", "card-air"], 5, 40)
    ],
    sources: [
      buildSource("source-bus", "bus", "seoul.bus", { route: "402", arsId: "23-005" }, 20_000, "fly-nrt", now - 4_000, {
        crowding: 2,
        eta_min: 4,
        headsign: "402번 강남역 방면",
        next_eta_min: 12,
        urgent: false
      }),
      buildSource("source-wx", "wx", "kma.now", { station: "Seoul-108" }, 600_000, "fly-nrt", now - 120_000, {
        condition: "humid cloudy",
        icon: "cloud",
        rainProb: 30,
        tempC: 27.4
      }),
      buildSource("source-air", "air", "airkorea", { station: "Gangnam-gu" }, 600_000, "fly-nrt", now - 280_000, {
        alert: false,
        grade: "good",
        pm10: 31,
        pm25: 18
      }),
      buildSource("source-calendar", "calendar", "google.calendar", { calendarId: "primary" }, 300_000, "convex", now - 42_000, {
        dateLabel: "Fri 24 Jul",
        next: {
          startsAt: "19:30",
          title: "Dinner in Seongsu"
        }
      }),
      buildSource("source-spotify", "spotify", "spotify.nowPlaying", { account: "demo" }, 15_000, "convex", now - 6_000, {
        artist: "Balming Tiger",
        isPlaying: true,
        track: "Seoul"
      }),
      buildSource("source-github", "github", "github.repo", { repo: "injoon5/display" }, 600_000, "convex", now - 320_000, {
        failingChecks: 0,
        latest: "Convex backend bootstrap",
        openPullRequests: 2
      }),
      buildSource("source-indoor", "indoor", "panel.indoor", { room: "bedroom" }, 60_000, "convex", now - 5_000, {
        humidity: 51.2,
        presenceBed: false,
        presenceRoom: true,
        tempC: 24.1
      }),
      buildSource("source-poke", "poke", "panel.debug", { scope: "editor" }, 30_000, "convex", now - 2_000, {
        message: "preview synced"
      })
    ],
    telemetry: {
      at: now,
      brightness: 62,
      estAmps: 0.84,
      governorActive: false,
      heapFree: 183_000,
      humidity: 51.2,
      lux: 128,
      presenceBed: false,
      presenceRoom: true,
      rssi: -54,
      tempC: 24.1
    }
  };
}

function buildScene(
  id: string,
  name: string,
  cardIds: string[],
  homekitIdentifier: number,
  brightnessCeiling: number,
  schedule?: string
): DashboardScene {
  return {
    _creationTime: Date.now(),
    _id: id,
    brightnessCeiling,
    cardIds,
    enabled: true,
    homekitIdentifier,
    name,
    schedule
  };
}

function buildSource(
  id: string,
  sourceId: string,
  kind: string,
  config: Record<string, unknown>,
  intervalMs: number,
  origin: "convex" | "fly-nrt" | "oracle-icn",
  fetchedAt: number,
  data: Record<string, unknown>
): DashboardSource {
  return {
    _creationTime: Date.now(),
    _id: id,
    config,
    consecutiveFailures: 0,
    data,
    fetchedAt,
    intervalMs,
    kind,
    origin,
    sourceId
  };
}

function buildCard(input: {
  estimatedAmps: number;
  name: string;
  priority?: number;
  slug: string;
  source: object;
}): DashboardCard {
  const sourceString = JSON.stringify(input.source, null, 2);
  const slotMap = extractSlotMap(sourceString);
  return {
    _creationTime: Date.now(),
    _id: `card-${input.slug}`,
    diagnostics: [],
    dwellMs: 10_000,
    enabled: true,
    estimatedAmps: input.estimatedAmps,
    name: input.name,
    priority: input.priority ?? 50,
    slug: input.slug,
    slotMap,
    source: sourceString,
    sourceRefs: [...new Set(slotMap.map((entry) => entry.sourceId))],
    updatedAt: Date.now()
  };
}

function extractSlotMap(source: string): SlotMapEntry[] {
  try {
    const parsed = JSON.parse(source) as { elements?: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.elements)) {
      return [];
    }
    const seen = new Set<string>();
    const slotMap: SlotMapEntry[] = [];
    for (const element of parsed.elements) {
      const bind = typeof element.bind === "string" ? element.bind : null;
      if (!bind || seen.has(bind)) {
        continue;
      }
      seen.add(bind);
      slotMap.push({
        index: slotMap.length,
        path: bind,
        sourceId: bind.split(".")[0] ?? "unknown",
        type: typeof element.type === "string" ? element.type : inferTypeFromPath(bind)
      });
    }
    return slotMap;
  } catch {
    return [];
  }
}

function inferTypeFromPath(path: string): string {
  if (path.endsWith("urgent") || path.endsWith("online") || path.endsWith("alert")) {
    return "boolean";
  }
  if (path.endsWith("eta_min") || path.endsWith("tempC") || path.endsWith("humidity") || path.endsWith("pm25")) {
    return "number";
  }
  return "string";
}

function hydrateMockState(): void {
  const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!cached) {
    return;
  }
  try {
    const parsed = JSON.parse(cached) as DashboardState;
    if (parsed && Array.isArray(parsed.cards) && Array.isArray(parsed.devices)) {
      mockState.set(parsed);
    }
  } catch {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
}

function mergeDashboardState(mock: DashboardState, live: Partial<DashboardState>): DashboardState {
  return {
    cards: live.cards && live.cards.length > 0 ? live.cards : mock.cards,
    devices: live.devices && live.devices.length > 0 ? live.devices : mock.devices,
    firmware: live.firmware && live.firmware.length > 0 ? live.firmware : mock.firmware,
    rules: live.rules && live.rules.length > 0 ? live.rules : mock.rules,
    scenes: live.scenes && live.scenes.length > 0 ? live.scenes : mock.scenes,
    sources: live.sources && live.sources.length > 0 ? live.sources : mock.sources,
    telemetry: live.telemetry ?? mock.telemetry
  };
}

async function startLiveSync(): Promise<void> {
  if (!client || subscriptionsStarted) {
    return;
  }
  subscriptionsStarted = true;
  syncStatus.set({
    lastError: null,
    live: true,
    mode: "live"
  });

  client.subscribeToConnectionState((connectionState) => {
    syncStatus.update((status) => ({
      lastError: status.lastError,
      live: connectionState.hasInflightRequests || connectionState.connectionCount > 0,
      mode: status.mode
    }));
  });

  const subscribe = <T>(
    assign: keyof DashboardState,
    run: (callback: (value: T) => void, onError: (error: Error) => void) => void
  ): void => {
    run(
      (value) => {
        liveState.update((state) => ({ ...state, [assign]: value }));
        syncStatus.update((status) => ({
          lastError: null,
          live: true,
          mode: "live"
        }));
      },
      (error) => {
        syncStatus.set({
          lastError: error.message,
          live: false,
          mode: "degraded"
        });
      }
    );
  };

  subscribe("cards", (callback, onError) => {
    client.onUpdate(api.cards.list, {}, callback as never, onError);
  });
  subscribe("devices", (callback, onError) => {
    client.onUpdate(api.devices.list, {}, callback as never, onError);
  });
  subscribe("scenes", (callback, onError) => {
    client.onUpdate(api.scenes.list, {}, callback as never, onError);
  });
  subscribe("rules", (callback, onError) => {
    client.onUpdate(api.rules.list, {}, callback as never, onError);
  });
  subscribe("sources", (callback, onError) => {
    client.onUpdate(api.sources.getAll, {}, callback as never, onError);
  });
  subscribe("firmware", (callback, onError) => {
    client.onUpdate(api.firmware.list, {}, callback as never, onError);
  });
}

export function resetMockState(): void {
  mockState.set(createSeedState());
}

export async function seedLiveDemo(): Promise<void> {
  if (!client) {
    resetMockState();
    return;
  }
  await client.client.mutation("lib/seed:seedDemo", {});
}

export async function saveCard(input: {
  cardId?: string;
  dwellMs: number;
  enabled: boolean;
  estimatedAmps: number;
  name: string;
  priority: number;
  slug: string;
  source: string;
  diagnostics?: DashboardDiagnostic[];
  slotMap?: SlotMapEntry[];
  sourceRefs?: string[];
}): Promise<DashboardCard> {
  if (client) {
    return await client.mutation(api.cards.save, input as never) as DashboardCard;
  }

  const slotMap = input.slotMap ?? extractSlotMap(input.source);
  const next: DashboardCard = {
    _creationTime: Date.now(),
    _id: input.cardId ?? `card-${input.slug}`,
    diagnostics: input.diagnostics ?? [],
    dwellMs: input.dwellMs,
    enabled: input.enabled,
    estimatedAmps: input.estimatedAmps,
    name: input.name,
    priority: input.priority,
    slug: input.slug,
    slotMap,
    source: input.source,
    sourceRefs: input.sourceRefs ?? [...new Set(slotMap.map((entry) => entry.sourceId))],
    updatedAt: Date.now()
  };
  mockState.update((state) => ({
    ...state,
    cards: upsert(state.cards, next, (card) => card._id)
  }));
  return next;
}

export async function deployCard(
  cardIds: string[],
  deviceId: string,
  bytecode?: Uint8Array,
): Promise<{ etag: string; size: number }> {
  if (client) {
    const result = await client.action(api.programsCompile.compileAndDeployMxr, {
      cardIds,
      deviceId,
      ...(bytecode ? { bytecode } : {}),
    } as never) as { etag: string; size: number };
    return result;
  }

  mockState.update((state) => ({
    ...state,
    devices: state.devices.map((device) =>
      device._id === deviceId
        ? {
            ...device,
            programVersion: device.programVersion + 1,
            programEtag: `"mock-${Date.now()}"`
          }
        : device
    )
  }));
  return { etag: `"mock-${Date.now()}"`, size: bytecode?.length ?? cardIds.length };
}

export async function saveScene(input: {
  brightnessCeiling?: number;
  cardIds: string[];
  enabled: boolean;
  homekitIdentifier: number;
  name: string;
  sceneId?: string;
  schedule?: string;
}): Promise<void> {
  if (client) {
    await client.mutation(api.scenes.save, input as never);
    return;
  }
  const next: DashboardScene = {
    _creationTime: Date.now(),
    _id: input.sceneId ?? `scene-${input.name}`,
    brightnessCeiling: input.brightnessCeiling,
    cardIds: input.cardIds,
    enabled: input.enabled,
    homekitIdentifier: input.homekitIdentifier,
    name: input.name,
    schedule: input.schedule
  };
  mockState.update((state) => ({
    ...state,
    scenes: upsert(state.scenes, next, (scene) => scene._id)
  }));
}

export async function saveRule(input: {
  action: DashboardRule["action"];
  condition: string;
  enabled: boolean;
  name: string;
  priority: number;
  ruleId?: string;
}): Promise<void> {
  if (client) {
    await client.mutation(api.rules.save, input as never);
    return;
  }
  const next: DashboardRule = {
    _creationTime: Date.now(),
    _id: input.ruleId ?? `rule-${input.name}`,
    action: input.action,
    condition: input.condition,
    enabled: input.enabled,
    name: input.name,
    priority: input.priority
  };
  mockState.update((state) => ({
    ...state,
    rules: upsert(state.rules, next, (rule) => rule._id)
  }));
}

export async function writeSource(input: {
  data: Record<string, unknown>;
  intervalMs: number;
  kind: string;
  origin: "convex" | "fly-nrt" | "oracle-icn";
  sourceId: string;
}): Promise<void> {
  if (client) {
    await client.mutation(api.sources.write, {
      ...input,
      config: {}
    } as never);
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
        sourceId: input.sourceId
      },
      (source) => source.sourceId
    )
  }));
}

export async function publishFirmware(input: {
  channel: string;
  r2Url: string;
  sha256: string;
  signature: string;
  version: string;
}): Promise<void> {
  if (client) {
    await client.mutation(api.firmware.publish, input as never);
    return;
  }
  mockState.update((state) => ({
    ...state,
    firmware: [
      {
        _creationTime: Date.now(),
        _id: `fw-${input.version}`,
        ...input,
        releasedAt: Date.now()
      },
      ...state.firmware
    ]
  }));
}

export function getCardBySlug(slug: string): DashboardCard | null {
  return get(state).cards.find((card) => card.slug === slug) ?? null;
}

export function getActiveScene(device: DashboardDevice | null): DashboardScene | null {
  if (!device?.activeSceneId) {
    return null;
  }
  return get(state).scenes.find((scene) => scene._id === device.activeSceneId) ?? null;
}

export function buildSlotSnapshot(
  slotMap: SlotMapEntry[],
  options: {
    device?: DashboardDevice | null;
    nowMs: number;
    overrides?: Record<string, unknown>;
    sources?: DashboardSource[];
    telemetry?: DashboardTelemetry;
  }
): SlotSnapshot {
  const sourceList = options.sources ?? get(state).sources;
  const device = options.device ?? get(primaryDevice);
  const telemetryValue = options.telemetry ?? get(state).telemetry;
  const overrides = options.overrides ?? {};
  const sourceMap = new Map(sourceList.map((source) => [source.sourceId, source]));
  const rootData: Record<string, Record<string, unknown>> = Object.fromEntries(
    sourceList.map((source) => [source.sourceId, source.data])
  );
  if (device) {
    rootData.device = {
      fwVersion: device.fwVersion,
      lastSeen: device.lastSeen,
      name: device.name,
      online: device.online,
      programVersion: device.programVersion
    };
  }
  rootData.telemetry = {
    brightness: telemetryValue.brightness,
    estAmps: telemetryValue.estAmps,
    governorActive: telemetryValue.governorActive,
    heapFree: telemetryValue.heapFree,
    humidity: telemetryValue.humidity,
    lux: telemetryValue.lux,
    presenceBed: telemetryValue.presenceBed,
    presenceRoom: telemetryValue.presenceRoom,
    rssi: telemetryValue.rssi,
    tempC: telemetryValue.tempC
  };
  const kst = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Seoul",
    weekday: "short"
  }).formatToParts(new Date(options.nowMs));
  rootData.time = {
    hour: Number(kst.find((part) => part.type === "hour")?.value ?? "0"),
    minute: Number(kst.find((part) => part.type === "minute")?.value ?? "0"),
    weekday: kst.find((part) => part.type === "weekday")?.value ?? "Mon"
  };

  const byIndex: Record<number, SourceSlot> = {};
  const byPath: Record<string, SourceSlot> = {};
  for (const entry of slotMap) {
    const baseValue = resolvePath(rootData, entry.path);
    const value = entry.path in overrides ? overrides[entry.path] : baseValue;
    const updatedMs = sourceMap.get(entry.sourceId)?.fetchedAt ?? device?.lastSeen ?? options.nowMs;
    const slot: SourceSlot = {
      path: entry.path,
      sourceId: entry.sourceId,
      type: entry.type,
      updatedMs,
      value
    };
    byIndex[entry.index] = slot;
    byPath[entry.path] = slot;
  }
  return { byIndex, byPath };
}

function resolvePath(rootData: Record<string, Record<string, unknown>>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = rootData;
  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current ?? null;
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
