import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  devices: defineTable({
    name: v.string(),
    tokenHash: v.string(),
    programVersion: v.number(),
    programEtag: v.string(),
    programStorageId: v.optional(v.id("_storage")),
    dataVersion: v.number(),
    dataEtag: v.string(),
    activeSceneId: v.optional(v.id("scenes")),
    pinnedCardId: v.optional(v.id("cards")),
    pinnedUntil: v.optional(v.number()),
    fwVersion: v.string(),
    fwChannel: v.union(v.literal("dev"), v.literal("stable")),
    online: v.boolean(),
    lastSeen: v.number(),
  }).index("by_token", ["tokenHash"]),

  cards: defineTable({
    slug: v.string(),
    name: v.string(),
    source: v.string(),
    compiledStorageId: v.optional(v.id("_storage")),
    slotMap: v.array(
      v.object({
        index: v.number(),
        path: v.string(),
        type: v.string(),
        sourceId: v.string(),
      }),
    ),
    sourceRefs: v.array(v.string()),
    diagnostics: v.array(
      v.object({
        severity: v.string(),
        message: v.string(),
        line: v.number(),
        col: v.number(),
      }),
    ),
    estimatedAmps: v.number(),
    enabled: v.boolean(),
    priority: v.number(),
    dwellMs: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  cardVersions: defineTable({
    cardId: v.id("cards"),
    version: v.number(),
    source: v.string(),
    compiledStorageId: v.id("_storage"),
    deployedAt: v.number(),
  }).index("by_card", ["cardId", "version"]),

  scenes: defineTable({
    name: v.string(),
    cardIds: v.array(v.id("cards")),
    schedule: v.optional(v.string()),
    brightnessCeiling: v.optional(v.number()),
    homekitIdentifier: v.number(),
    enabled: v.boolean(),
  }),

  rules: defineTable({
    name: v.string(),
    condition: v.string(),
    action: v.object({
      kind: v.string(),
      cardId: v.optional(v.id("cards")),
      sceneId: v.optional(v.id("scenes")),
      durationMs: v.optional(v.number()),
      value: v.optional(v.number()),
    }),
    priority: v.number(),
    enabled: v.boolean(),
  }),

  sources: defineTable({
    sourceId: v.string(),
    kind: v.string(),
    config: v.any(),
    intervalMs: v.number(),
    origin: v.union(v.literal("convex"), v.literal("oracle-icn")),
    data: v.any(),
    fetchedAt: v.number(),
    error: v.optional(v.string()),
    consecutiveFailures: v.number(),
    circuitOpenUntil: v.optional(v.number()),
  }).index("by_sourceId", ["sourceId"]),

  telemetry: defineTable({
    deviceId: v.id("devices"),
    at: v.number(),
    rssi: v.number(),
    heapFree: v.number(),
    brightness: v.number(),
    lux: v.number(),
    tempC: v.number(),
    humidity: v.number(),
    presenceRoom: v.boolean(),
    presenceBed: v.boolean(),
    estAmps: v.number(),
    governorActive: v.boolean(),
    lastError: v.optional(v.string()),
  }).index("by_device_time", ["deviceId", "at"]),

  firmware: defineTable({
    version: v.string(),
    channel: v.string(),
    r2Url: v.string(),
    sha256: v.string(),
    signature: v.string(),
    releasedAt: v.number(),
  }).index("by_channel", ["channel", "releasedAt"]),
});
