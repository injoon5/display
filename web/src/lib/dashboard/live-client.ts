import { browser } from "$app/environment";
import { env } from "$env/dynamic/public";
import { api } from "../../../../convex/_generated/api.js";
import { ConvexClient } from "convex/browser";
import { derived, get, writable } from "svelte/store";
import type {
  DashboardCard,
  DashboardDevice,
  DashboardFirmware,
  DashboardScene,
  DashboardSource,
  DashboardState,
  DashboardStatus,
  DashboardTelemetry,
  DeployCardResult,
  PartialLiveDashboardState,
  PublishFirmwareInput,
  SaveCardInput,
  SaveRuleInput,
  SaveSceneInput,
  WriteSourceInput,
} from "./types";

type RawSourceOrigin = DashboardSource["origin"] | "fly-nrt";

type RawDashboardSource = Omit<DashboardSource, "origin"> & {
  origin: RawSourceOrigin;
};

type RawDashboardTelemetry = DashboardTelemetry & {
  _creationTime: number;
  _id: string;
  deviceId: string;
  lastError?: string;
};

const convexUrl = (env.PUBLIC_CONVEX_URL ?? "").trim();

const liveSlices = writable<PartialLiveDashboardState>({});

export const dashboardStatus = writable<DashboardStatus>({
  lastError: null,
  live: false,
  mode: "mock",
});

export const liveState = derived(liveSlices, ($liveSlices) =>
  isLiveStateComplete($liveSlices) ? $liveSlices : null,
);

const client = browser && convexUrl ? new ConvexClient(convexUrl, { unsavedChangesWarning: false }) : null;

let connectionActive = false;
let lastError: string | null = null;
let subscriptionsStarted = false;

function isLiveStateComplete(state: PartialLiveDashboardState): state is DashboardState {
  return (
    Array.isArray(state.cards) &&
    Array.isArray(state.devices) &&
    Array.isArray(state.firmware) &&
    Array.isArray(state.rules) &&
    Array.isArray(state.scenes) &&
    Array.isArray(state.sources) &&
    state.telemetry !== undefined
  );
}

function refreshStatus(): void {
  const ready = isLiveStateComplete(get(liveSlices));
  if (lastError) {
    dashboardStatus.set({
      lastError,
      live: false,
      mode: "degraded",
    });
    return;
  }

  dashboardStatus.set({
    lastError: null,
    live: connectionActive && ready,
    mode: connectionActive && ready ? "live" : "mock",
  });
}

function requireClient(): ConvexClient {
  if (!client) {
    throw new Error("Convex client is not configured");
  }
  return client;
}

function normalizeSourceOrigin(origin: RawSourceOrigin): DashboardSource["origin"] {
  switch (origin) {
    case "convex":
      return "convex";
    case "oracle-icn":
      return "oracle-icn";
    case "fly-nrt":
      return "oracle-icn";
    default: {
      const exhaustive: never = origin;
      return exhaustive;
    }
  }
}

function normalizeSources(sources: RawDashboardSource[]): DashboardSource[] {
  return sources.map((source) => ({
    ...source,
    origin: normalizeSourceOrigin(source.origin),
  }));
}

function normalizeTelemetry(telemetry: RawDashboardTelemetry): DashboardTelemetry {
  return {
    at: telemetry.at,
    brightness: telemetry.brightness,
    estAmps: telemetry.estAmps,
    governorActive: telemetry.governorActive,
    heapFree: telemetry.heapFree,
    humidity: telemetry.humidity,
    lux: telemetry.lux,
    presenceBed: telemetry.presenceBed,
    presenceRoom: telemetry.presenceRoom,
    rssi: telemetry.rssi,
    tempC: telemetry.tempC,
  };
}

function setLiveSlice<K extends keyof DashboardState>(key: K, value: DashboardState[K]): void {
  liveSlices.update((state) => ({
    ...state,
    [key]: value,
  }));
  lastError = null;
  refreshStatus();
}

function clearLiveSlice<K extends keyof DashboardState>(key: K): void {
  liveSlices.update((state) => {
    const next = { ...state };
    delete next[key];
    return next;
  });
  refreshStatus();
}

async function startLiveSync(): Promise<void> {
  if (!client || subscriptionsStarted) {
    return;
  }

  subscriptionsStarted = true;
  client.subscribeToConnectionState((connectionState) => {
    connectionActive = connectionState.hasInflightRequests || connectionState.connectionCount > 0;
    refreshStatus();
  });

  const subscribe = <T, K extends keyof DashboardState>(
    key: K,
    run: (callback: (value: T) => void, onError: (error: Error) => void) => void,
    normalize: (value: T) => DashboardState[K],
  ): void => {
    run(
      (value) => {
        setLiveSlice(key, normalize(value));
      },
      (error) => {
        lastError = error.message;
        refreshStatus();
      },
    );
  };

  subscribe("cards", (callback, onError) => {
    client.onUpdate(api.cards.list, {}, callback as never, onError);
  }, (value) => value as DashboardCard[]);

  subscribe("devices", (callback, onError) => {
    client.onUpdate(api.devices.list, {}, callback as never, onError);
  }, (value) => value as DashboardDevice[]);

  subscribe("scenes", (callback, onError) => {
    client.onUpdate(api.scenes.list, {}, callback as never, onError);
  }, (value) => value as DashboardScene[]);

  subscribe("rules", (callback, onError) => {
    client.onUpdate(api.rules.list, {}, callback as never, onError);
  }, (value) => value as DashboardState["rules"]);

  subscribe("sources", (callback, onError) => {
    client.onUpdate(api.sources.getAll, {}, callback as never, onError);
  }, (value) => normalizeSources(value as RawDashboardSource[]));

  subscribe("firmware", (callback, onError) => {
    client.onUpdate(api.firmware.list, {}, callback as never, onError);
  }, (value) => value as DashboardFirmware[]);

  client.onUpdate(
    api.telemetry.latest,
    {},
    ((value: RawDashboardTelemetry | null) => {
      if (value) {
        setLiveSlice("telemetry", normalizeTelemetry(value));
        return;
      }
      clearLiveSlice("telemetry");
    }) as never,
    (error) => {
      lastError = error.message;
      refreshStatus();
    },
  );
}

if (browser) {
  void startLiveSync();
}

export function hasLiveClient(): boolean {
  return client !== null;
}

export async function seedLiveDemo(): Promise<void> {
  await requireClient().client.mutation("lib/seed:seedDemo", {});
}

export async function saveCardLive(input: SaveCardInput): Promise<DashboardCard> {
  return (await requireClient().mutation(api.cards.save, input as never)) as DashboardCard;
}

export async function deployCardLive(
  cardIds: string[],
  deviceId: string,
  bytecode?: Uint8Array,
): Promise<DeployCardResult> {
  const result = (await requireClient().action(
    api.programsActions.compileAndDeploy,
    {
      cardIds,
      deviceId,
      ...(bytecode ? { bytecode } : {}),
    } as never,
  )) as DeployCardResult;

  return {
    etag: result.etag,
    size: result.size,
  };
}

export async function saveSceneLive(input: SaveSceneInput): Promise<void> {
  await requireClient().mutation(api.scenes.save, input as never);
}

export async function saveRuleLive(input: SaveRuleInput): Promise<void> {
  await requireClient().mutation(api.rules.save, input as never);
}

export async function writeSourceLive(input: WriteSourceInput): Promise<void> {
  await requireClient().mutation(
    api.sources.write,
    {
      ...input,
      config: {},
    } as never,
  );
}

export async function publishFirmwareLive(input: PublishFirmwareInput): Promise<void> {
  await requireClient().mutation(api.firmware.publish, input as never);
}
