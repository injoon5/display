import { compile } from "$lib/compiler";
import {
  deployCardLive,
  hasLiveClient,
  publishFirmwareLive,
  saveCardLive,
  saveRuleLive,
  saveSceneLive,
  seedLiveDemo as seedLiveDemoLive,
  writeSourceLive,
} from "./live-client";
import { mockState, resetMockState } from "./mock-store";
import type {
  DashboardCard,
  DashboardDiagnostic,
  DashboardFirmware,
  DashboardRule,
  DashboardScene,
  DeployCardResult,
  PublishFirmwareInput,
  SaveCardInput,
  SaveRuleInput,
  SaveSceneInput,
  WriteSourceInput,
} from "./types";

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
    await seedLiveDemoLive();
    return;
  }

  resetMockState();
}

export async function saveCard(input: SaveCardInput): Promise<DashboardCard> {
  if (hasLiveClient()) {
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
  if (hasLiveClient()) {
    return await deployCardLive(cardIds, deviceId, bytecode);
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
  if (hasLiveClient()) {
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
  if (hasLiveClient()) {
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
  if (hasLiveClient()) {
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
  if (hasLiveClient()) {
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
