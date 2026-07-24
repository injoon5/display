import type { SlotMapEntry } from "$lib/compiler";

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
  brightnessCeiling?: number;
  dataEtag: string;
  dataVersion: number;
  fwChannel: "dev" | "stable";
  fwVersion: string;
  lastSeen: number;
  name: string;
  online: boolean;
  pinnedCardId?: string;
  pinnedUntil?: number;
  playlistCardId?: string;
  playlistCardIds?: string[];
  programEtag: string;
  programStorageId?: string;
  programVersion: number;
  tokenHash: string;
};

export type SourceOrigin = "convex" | "oracle-icn";

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
  origin: SourceOrigin;
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

export type DashboardStatus = {
  lastError: string | null;
  live: boolean;
  mode: "degraded" | "live" | "mock";
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

export type SaveCardInput = {
  cardId?: string;
  diagnostics?: DashboardDiagnostic[];
  dwellMs: number;
  enabled: boolean;
  estimatedAmps: number;
  name: string;
  priority: number;
  slug: string;
  slotMap?: SlotMapEntry[];
  source: string;
  sourceRefs?: string[];
};

export type DeployCardResult = {
  etag: string;
  size: number;
};

export type SaveSceneInput = {
  brightnessCeiling?: number;
  cardIds: string[];
  enabled: boolean;
  homekitIdentifier: number;
  name: string;
  sceneId?: string;
  schedule?: string;
};

export type SaveRuleInput = {
  action: DashboardRule["action"];
  condition: string;
  enabled: boolean;
  name: string;
  priority: number;
  ruleId?: string;
};

export type WriteSourceInput = {
  data: Record<string, unknown>;
  intervalMs: number;
  kind: string;
  origin: SourceOrigin;
  sourceId: string;
};

export type PublishFirmwareInput = {
  channel: string;
  r2Url: string;
  sha256: string;
  signature: string;
  version: string;
};

export type PinCardInput = {
  cardId: string;
  deviceId: string;
  durationMs?: number;
};

export type ActivateSceneInput = {
  deviceId: string;
  sceneId: string;
};

export type SimulateTelemetryInput = {
  brightness?: number;
  deviceId: string;
  estAmps?: number;
  lux?: number;
  presenceRoom?: boolean;
};

export type PokeInput = {
  deviceId: string;
  durationMs?: number;
  message: string;
};

export type LiveDashboardState = DashboardState;
export type PartialLiveDashboardState = Partial<LiveDashboardState>;
