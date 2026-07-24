import type { SlotMapEntry } from "$lib/compiler";
import { resolveSlotValue } from "$lib/compiler";
import { buildRuntimeScope } from "./runtime-scope";
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

let snapshotContext: SnapshotContext | null = null;

export function setSlotSnapshotContext(context: SnapshotContext): void {
  snapshotContext = context;
}

export function sourceIdFromPath(path: string): string {
  return path.split(".")[0] ?? "unknown";
}

export function resolvePath(rootData: Record<string, unknown>, path: string): unknown {
  return resolveSlotValue(rootData, path);
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
  const activeScene = device?.activeSceneId
    ? currentState.scenes.find((scene) => scene._id === device.activeSceneId)
    : null;

  const rootData = buildRuntimeScope({
    device: device
      ? {
          fwVersion: device.fwVersion,
          lastSeen: device.lastSeen,
          name: device.name,
          online: device.online,
          programVersion: device.programVersion,
        }
      : null,
    nowMs: options.nowMs,
    sceneName: activeScene?.name ?? null,
    sources: sourceList.map((source) => ({
      data: source.data,
      fetchedAt: source.fetchedAt,
      sourceId: source.sourceId,
    })),
    telemetry: {
      brightness: telemetry.brightness,
      estAmps: telemetry.estAmps,
      governorActive: telemetry.governorActive,
      heapFree: telemetry.heapFree,
      humidity: telemetry.humidity,
      lux: telemetry.lux,
      presenceRoom: telemetry.presenceRoom,
      rssi: telemetry.rssi,
      tempC: telemetry.tempC,
    },
    uptimeSeconds: device
      ? Math.max(0, Math.floor((options.nowMs - device._creationTime) / 1000))
      : 0,
  });

  const byIndex: Record<number, SourceSlot> = {};
  const byPath: Record<string, SourceSlot> = {};

  for (const entry of slotMap) {
    const baseValue = resolvePath(rootData, entry.path);
    const value = entry.path in overrides ? overrides[entry.path] : baseValue;
    const updatedMs =
      sourceMap.get(entry.sourceId)?.fetchedAt ??
      (entry.sourceId === "now" || entry.sourceId === "time" || entry.sourceId === "ambient"
        ? options.nowMs
        : entry.sourceId === "room"
          ? (sourceMap.get("indoor")?.fetchedAt ?? device?.lastSeen ?? options.nowMs)
          : (device?.lastSeen ?? options.nowMs));
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
