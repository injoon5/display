import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { dashboardMutation, hashToken } from "../auth";
import { buildCardDocument } from "../cards";
import { bumpAllDevicesDataEtag } from "../devices";

export const DEMO_DEVICE_TOKEN = "dev-token-matrix-panel-demo";

type SeedCardInput = {
  slug: string;
  name: string;
  source: string;
  estimatedAmps?: number;
  priority?: number;
  dwellMs?: number;
};

const seedSources = [
  {
    sourceId: "bus",
    kind: "seoul.bus",
    config: { route: "402", arsId: "23-005" },
    intervalMs: 20_000,
    origin: "fly-nrt" as const,
    data: {
      eta_min: 4,
      next_eta_min: 12,
      crowding: 2,
      headsign: "402번 강남역 방면",
      urgent: false,
    },
  },
  {
    sourceId: "wx",
    kind: "kma.now",
    config: { station: "Seoul-108" },
    intervalMs: 600_000,
    origin: "fly-nrt" as const,
    data: {
      tempC: 27.4,
      condition: "humid cloudy",
      rainProb: 30,
      icon: "cloud",
    },
  },
  {
    sourceId: "air",
    kind: "airkorea",
    config: { station: "Gangnam-gu" },
    intervalMs: 600_000,
    origin: "fly-nrt" as const,
    data: {
      pm25: 18,
      pm10: 31,
      grade: "good",
      alert: false,
    },
  },
  {
    sourceId: "calendar",
    kind: "google.calendar",
    config: { calendarId: "primary" },
    intervalMs: 300_000,
    origin: "convex" as const,
    data: {
      dateLabel: "Fri 24 Jul",
      next: {
        title: "Dinner in Seongsu",
        startsAt: "19:30",
      },
    },
  },
  {
    sourceId: "spotify",
    kind: "spotify.nowPlaying",
    config: { account: "demo" },
    intervalMs: 15_000,
    origin: "convex" as const,
    data: {
      isPlaying: true,
      track: "Seoul",
      artist: "Balming Tiger",
    },
  },
  {
    sourceId: "github",
    kind: "github.repo",
    config: { repo: "injoon5/display" },
    intervalMs: 600_000,
    origin: "convex" as const,
    data: {
      failingChecks: 0,
      openPullRequests: 2,
      latest: "Convex backend bootstrap",
    },
  },
  {
    sourceId: "indoor",
    kind: "panel.indoor",
    config: { room: "bedroom" },
    intervalMs: 60_000,
    origin: "convex" as const,
    data: {
      tempC: 24.1,
      humidity: 51.2,
      presenceRoom: true,
      presenceBed: false,
    },
  },
];

const seedCards: SeedCardInput[] = [
  {
    slug: "bus-402",
    name: "Bus 402",
    priority: 90,
    dwellMs: 12_000,
    source: JSON.stringify({
      id: "bus-402",
      elements: [
        { op: "text", x: 1, y: 2, font: "3x5", color: "#1a5fb4", value: "402" },
        { op: "text", x: 20, y: 2, font: "5x7", color: "#ffffff", bind: "bus.eta_min", type: "number" },
        { op: "text", x: 36, y: 2, font: "5x7", color: "#ffffff", value: "분" },
        { op: "text", x: 20, y: 12, font: "3x5", color: "#666666", bind: "bus.next_eta_min", type: "number" },
        { op: "text", x: 1, y: 24, font: "3x5", color: "#aaaaaa", bind: "bus.headsign", type: "string" },
      ],
    }),
  },
  {
    slug: "weather",
    name: "Weather",
    source: JSON.stringify({
      id: "weather",
      elements: [
        { op: "text", x: 1, y: 2, font: "5x7", color: "#ffffff", bind: "wx.tempC", type: "number" },
        { op: "text", x: 22, y: 2, font: "5x7", color: "#ffffff", value: "C" },
        { op: "text", x: 1, y: 14, font: "3x5", color: "#999999", bind: "wx.condition", type: "string" },
      ],
    }),
  },
  {
    slug: "air",
    name: "Air Quality",
    source: JSON.stringify({
      id: "air",
      elements: [
        { op: "text", x: 1, y: 2, font: "3x5", color: "#999999", value: "PM2.5" },
        { op: "text", x: 1, y: 12, font: "5x7", color: "#ffffff", bind: "air.pm25", type: "number" },
        { op: "text", x: 24, y: 12, font: "3x5", color: "#999999", bind: "air.grade", type: "string" },
      ],
    }),
  },
  {
    slug: "clock",
    name: "Clock",
    source: JSON.stringify({
      id: "clock",
      elements: [
        { op: "text", x: 4, y: 4, font: "5x7", color: "#ffffff", value: "07:21" },
        { op: "text", x: 4, y: 18, font: "3x5", color: "#888888", bind: "calendar.dateLabel", type: "string" },
      ],
    }),
  },
  {
    slug: "clock-dim",
    name: "Clock Dim",
    source: JSON.stringify({
      id: "clock-dim",
      elements: [
        { op: "text", x: 8, y: 10, font: "5x7", color: "#666666", value: "07:21" },
      ],
    }),
  },
  {
    slug: "indoor",
    name: "Indoor",
    source: JSON.stringify({
      id: "indoor",
      elements: [
        { op: "text", x: 1, y: 2, font: "5x7", color: "#ffffff", bind: "indoor.tempC", type: "number" },
        { op: "text", x: 20, y: 2, font: "5x7", color: "#ffffff", value: "C" },
        { op: "text", x: 1, y: 14, font: "3x5", color: "#999999", bind: "indoor.humidity", type: "number" },
        { op: "text", x: 18, y: 14, font: "3x5", color: "#999999", value: "%" },
      ],
    }),
  },
  {
    slug: "calendar-next",
    name: "Calendar Next",
    source: JSON.stringify({
      id: "calendar-next",
      elements: [
        { op: "text", x: 1, y: 2, font: "3x5", color: "#999999", value: "NEXT" },
        { op: "text", x: 1, y: 10, font: "3x5", color: "#ffffff", bind: "calendar.next.title", type: "string" },
        { op: "text", x: 1, y: 22, font: "3x5", color: "#999999", bind: "calendar.next.startsAt", type: "string" },
      ],
    }),
  },
  {
    slug: "self-status",
    name: "Self Status",
    source: JSON.stringify({
      id: "self-status",
      elements: [
        { op: "text", x: 1, y: 2, font: "3x5", color: "#999999", value: "RSSI" },
        { op: "text", x: 24, y: 2, font: "3x5", color: "#ffffff", bind: "telemetry.rssi", type: "number" },
        { op: "text", x: 1, y: 12, font: "3x5", color: "#999999", value: "PRG" },
        { op: "text", x: 24, y: 12, font: "3x5", color: "#ffffff", bind: "device.programVersion", type: "number" },
        { op: "text", x: 1, y: 24, font: "3x5", color: "#ffffff", bind: "poke.message", type: "string" },
      ],
    }),
  },
];

export const seedDemo = dashboardMutation({
  args: {},
  returns: v.object({
    deviceId: v.id("devices"),
    cardIds: v.array(v.id("cards")),
    sceneIds: v.array(v.id("scenes")),
    ruleIds: v.array(v.id("rules")),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const tokenHash = await hashToken(DEMO_DEVICE_TOKEN);
    const existingDevice = await ctx.db
      .query("devices")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .unique();

    const deviceId =
      existingDevice?._id ??
      (await ctx.db.insert("devices", {
        name: "Wall Matrix Panel Demo",
        tokenHash,
        programVersion: 0,
        programEtag: "\"seed-program\"",
        dataVersion: 0,
        dataEtag: "\"seed-data\"",
        fwVersion: "1.4.2",
        fwChannel: "stable",
        online: true,
        lastSeen: now,
      }));

    if (existingDevice) {
      await ctx.db.patch("devices", existingDevice._id, {
        name: "Wall Matrix Panel Demo",
        fwVersion: "1.4.2",
        fwChannel: "stable",
        online: true,
        lastSeen: now,
      });
    }

    for (const source of seedSources) {
      const existing = await ctx.db
        .query("sources")
        .withIndex("by_sourceId", (q) => q.eq("sourceId", source.sourceId))
        .unique();
      const sourceInput = {
        ...source,
        fetchedAt: now,
        error: undefined,
        consecutiveFailures: 0,
        circuitOpenUntil: undefined,
      };

      if (existing) {
        await ctx.db.patch("sources", existing._id, sourceInput);
      } else {
        await ctx.db.insert("sources", sourceInput);
      }
    }

    const cardIds: Id<"cards">[] = [];
    const cardIdBySlug = new Map<string, Id<"cards">>();
    for (const card of seedCards) {
      const existing = await ctx.db.query("cards").withIndex("by_slug", (q) => q.eq("slug", card.slug)).unique();
      const cardInput = buildCardDocument(existing, {
        slug: card.slug,
        name: card.name,
        source: card.source,
        estimatedAmps: card.estimatedAmps,
        priority: card.priority,
        dwellMs: card.dwellMs,
        enabled: true,
      });

      const cardId = existing?._id ?? (await ctx.db.insert("cards", cardInput));
      if (existing) {
        await ctx.db.patch("cards", existing._id, cardInput);
      }

      cardIds.push(cardId);
      cardIdBySlug.set(card.slug, cardId);
    }

    const sceneSpecs = [
      {
        name: "morning",
        cardSlugs: ["bus-402", "weather", "calendar-next", "air"],
        schedule: "weekday 06:30-09:30",
        brightnessCeiling: 90,
        homekitIdentifier: 1,
      },
      {
        name: "day",
        cardSlugs: ["weather", "indoor", "calendar-next", "self-status"],
        brightnessCeiling: 100,
        homekitIdentifier: 2,
      },
      {
        name: "evening",
        cardSlugs: ["clock", "weather", "indoor", "self-status"],
        brightnessCeiling: 65,
        homekitIdentifier: 3,
      },
      {
        name: "night",
        cardSlugs: ["clock-dim"],
        schedule: "everyday 22:00-23:59",
        brightnessCeiling: 15,
        homekitIdentifier: 4,
      },
      {
        name: "away",
        cardSlugs: ["self-status", "air"],
        brightnessCeiling: 40,
        homekitIdentifier: 5,
      },
    ];

    const existingScenes = await ctx.db.query("scenes").collect();
    const sceneIds: Id<"scenes">[] = [];
    const sceneIdByName = new Map<string, Id<"scenes">>();
    for (const scene of sceneSpecs) {
      const existing = existingScenes.find((item) => item.name === scene.name);
      const cardRefs = scene.cardSlugs
        .map((slug) => cardIdBySlug.get(slug))
        .filter((id): id is Id<"cards"> => id !== undefined);
      const sceneInput = {
        name: scene.name,
        cardIds: cardRefs,
        schedule: scene.schedule,
        brightnessCeiling: scene.brightnessCeiling,
        homekitIdentifier: scene.homekitIdentifier,
        enabled: true,
      };

      const sceneId = existing?._id ?? (await ctx.db.insert("scenes", sceneInput));
      if (existing) {
        await ctx.db.patch("scenes", existing._id, sceneInput);
      }

      sceneIds.push(sceneId);
      sceneIdByName.set(scene.name, sceneId);
    }

    const ruleSpecs = [
      {
        name: "bus urgent",
        condition: "bus.urgent == true",
        action: {
          kind: "pin",
          cardId: cardIdBySlug.get("bus-402"),
          durationMs: 60_000,
        },
        priority: 100,
      },
      {
        name: "air alert",
        condition: "air.alert == true",
        action: {
          kind: "interrupt",
          cardId: cardIdBySlug.get("air"),
          durationMs: 45_000,
        },
        priority: 95,
      },
      {
        name: "sleep",
        condition: "time.hour >= 22 or time.hour < 6",
        action: {
          kind: "scene",
          sceneId: sceneIdByName.get("night"),
        },
        priority: 70,
      },
      {
        name: "room empty",
        condition: "indoor.presenceRoom == false and time.hour >= 8",
        action: {
          kind: "scene",
          sceneId: sceneIdByName.get("away"),
        },
        priority: 60,
      },
    ];

    const ruleIds: Id<"rules">[] = [];
    const existingRules = await ctx.db.query("rules").collect();
    for (const rule of ruleSpecs) {
      const existing = existingRules.find((item) => item.name === rule.name);
      const ruleInput = {
        name: rule.name,
        condition: rule.condition,
        action: {
          kind: rule.action.kind,
          cardId: rule.action.cardId,
          sceneId: rule.action.sceneId,
          durationMs: rule.action.durationMs,
          value: undefined,
        },
        priority: rule.priority,
        enabled: true,
      };
      const ruleId = existing?._id ?? (await ctx.db.insert("rules", ruleInput));
      if (existing) {
        await ctx.db.patch("rules", existing._id, ruleInput);
      }
      ruleIds.push(ruleId);
    }

    const daySceneId = sceneIdByName.get("day");
    if (daySceneId) {
      await ctx.db.patch("devices", deviceId, {
        activeSceneId: daySceneId,
      });
    }

    await bumpAllDevicesDataEtag(ctx, "seed-demo");

    return {
      deviceId,
      cardIds,
      sceneIds,
      ruleIds,
    };
  },
});
