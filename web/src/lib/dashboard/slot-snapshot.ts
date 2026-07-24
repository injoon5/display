import type { SlotMapEntry } from "$lib/compiler";
import type {
  DashboardDevice,
  DashboardSource,
  DashboardState,
  DashboardTelemetry,
  SlotSnapshot,
  SourceSlot,
} from "./types";

type SnapshotContext = {
  getPrimaryDevice: () => DashboardDevice | null;
  getState: () => DashboardState;
};

export type BuildSlotSnapshotOptions = {
  device?: DashboardDevice | null;
  nowMs: number;
  overrides?: Record<string, unknown>;
  sources?: DashboardSource[];
  telemetry?: DashboardTelemetry;
};

const SEOUL_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: "Asia/Seoul",
  weekday: "short",
});

let snapshotContext: SnapshotContext | null = null;

export function setSlotSnapshotContext(context: SnapshotContext): void {
  snapshotContext = context;
}

export function sourceIdFromPath(path: string): string {
  return path.split(".")[0] ?? "unknown";
}

export function resolvePath(rootData: Record<string, unknown>, path: string): unknown {
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

function buildTimeRoot(nowMs: number): Record<string, unknown> {
  const parts = SEOUL_TIME_FORMATTER.formatToParts(new Date(nowMs));
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"),
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "Mon",
  };
}

function buildRootData(
  sourceList: DashboardSource[],
  device: DashboardDevice | null,
  telemetry: DashboardTelemetry,
  nowMs: number,
): Record<string, unknown> {
  const rootData: Record<string, unknown> = Object.fromEntries(
    sourceList.map((source) => [source.sourceId, source.data]),
  );

  if (device) {
    rootData.device = {
      fwVersion: device.fwVersion,
      lastSeen: device.lastSeen,
      name: device.name,
      online: device.online,
      programVersion: device.programVersion,
    };
  }

  rootData.telemetry = {
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
  rootData.time = buildTimeRoot(nowMs);

  return rootData;
}

function getSnapshotContext(): SnapshotContext {
  if (!snapshotContext) {
    throw new Error("Slot snapshot context has not been initialized");
  }
  return snapshotContext;
}

export function buildSlotSnapshot(
  slotMap: SlotMapEntry[],
  options: BuildSlotSnapshotOptions,
): SlotSnapshot {
  const context = getSnapshotContext();
  const currentState = context.getState();
  const sourceList = options.sources ?? currentState.sources;
  const device = options.device ?? context.getPrimaryDevice();
  const telemetry = options.telemetry ?? currentState.telemetry;
  const overrides = options.overrides ?? {};
  const sourceMap = new Map(sourceList.map((source) => [source.sourceId, source]));
  const rootData = buildRootData(sourceList, device, telemetry, options.nowMs);

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
      value,
    };
    byIndex[entry.index] = slot;
    byPath[entry.path] = slot;
  }

  return { byIndex, byPath };
}
