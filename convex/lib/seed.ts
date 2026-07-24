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
    origin: "oracle-icn" as const,
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
    origin: "oracle-icn" as const,
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
    origin: "oracle-icn" as const,
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
    dwellMs: 12000,
    source: "{\n  \"id\": \"bus-402\",\n  \"name\": \"Bus 402\",\n  \"priority\": 90,\n  \"dwellMs\": 12000,\n  \"elements\": [\n    { \"op\": \"badge\", \"x\": 1, \"y\": 1, \"font\": \"3x5\", \"bg\": \"#1a5fb4\", \"fg\": \"#e0e0e0\", \"value\": \"402\" },\n    { \"op\": \"text\", \"x\": 20, \"y\": 2, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"ETA\" },\n    { \"op\": \"text\", \"x\": 20, \"y\": 10, \"font\": \"5x7\", \"color\": \"#e0e0e0\", \"bind\": \"bus.eta_min\" },\n    { \"op\": \"text\", \"x\": 38, \"y\": 10, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"m\" },\n    { \"op\": \"text\", \"x\": 1, \"y\": 21, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"NEXT\" },\n    { \"op\": \"text\", \"x\": 20, \"y\": 21, \"font\": \"3x5\", \"color\": \"#e0e0e0\", \"bind\": \"bus.next_eta_min\" },\n    { \"op\": \"text\", \"x\": 32, \"y\": 21, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"m\" },\n    { \"op\": \"text\", \"x\": 48, \"y\": 14, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"LOAD\" },\n    { \"op\": \"bar\", \"x\": 48, \"y\": 21, \"w\": 12, \"h\": 5, \"color\": \"#49c16d\", \"bg\": \"#1c2320\", \"bind\": \"bus.crowding\", \"max\": 3 }\n  ]\n}",
  },
  {
    slug: "weather",
    name: "Weather",
    priority: 70,
    dwellMs: 10000,
    source: "{\n  \"id\": \"weather\",\n  \"name\": \"Weather\",\n  \"priority\": 76,\n  \"dwellMs\": 8000,\n  \"elements\": [\n    { \"op\": \"text\", \"x\": 1, \"y\": 3, \"font\": \"3x5\", \"color\": \"#6fb1ff\", \"value\": \"NOW\" },\n    { \"op\": \"text\", \"x\": 1, \"y\": 11, \"font\": \"5x7\", \"color\": \"#e0e0e0\", \"bind\": \"wx.tempC\" },\n    { \"op\": \"text\", \"x\": 24, \"y\": 11, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"C\" },\n    { \"op\": \"text\", \"x\": 1, \"y\": 23, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"bind\": \"wx.condition\" }\n  ]\n}",
  },
  {
    slug: "air",
    name: "Air Quality",
    priority: 75,
    dwellMs: 10000,
    source: "{\n  \"id\": \"air\",\n  \"name\": \"Air Quality\",\n  \"priority\": 72,\n  \"dwellMs\": 8000,\n  \"elements\": [\n    { \"op\": \"text\", \"x\": 1, \"y\": 3, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"PM2.5\" },\n    { \"op\": \"text\", \"x\": 1, \"y\": 11, \"font\": \"5x7\", \"color\": \"#e0e0e0\", \"bind\": \"air.pm25\" },\n    { \"op\": \"text\", \"x\": 24, \"y\": 11, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"ug\" },\n    { \"op\": \"text\", \"x\": 1, \"y\": 23, \"font\": \"3x5\", \"color\": \"#52d6a7\", \"bind\": \"air.grade\" }\n  ]\n}",
  },
  {
    slug: "clock",
    name: "Clock",
    priority: 40,
    dwellMs: 8000,
    source: "{\n  \"id\": \"clock\",\n  \"name\": \"Clock\",\n  \"priority\": 64,\n  \"dwellMs\": 10000,\n  \"elements\": [\n    { \"op\": \"text\", \"x\": 11, \"y\": 8, \"font\": \"8x16\", \"color\": \"#e0e0e0\", \"bind\": \"now.hhmm\" }\n  ]\n}",
  },
  {
    slug: "clock-dim",
    name: "Clock Dim",
    priority: 30,
    dwellMs: 15000,
    source: "{\n  \"id\": \"clock-dim\",\n  \"name\": \"Clock Dim\",\n  \"priority\": 40,\n  \"dwellMs\": 12000,\n  \"elements\": [\n    { \"op\": \"text\", \"x\": 11, \"y\": 8, \"font\": \"8x16\", \"color\": \"#66706a\", \"bind\": \"now.hhmm\" }\n  ]\n}",
  },
  {
    slug: "indoor",
    name: "Indoor",
    priority: 60,
    dwellMs: 10000,
    source: "{\n  \"id\": \"indoor\",\n  \"name\": \"Indoor\",\n  \"priority\": 68,\n  \"dwellMs\": 8000,\n  \"elements\": [\n    { \"op\": \"text\", \"x\": 1, \"y\": 3, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"ROOM\" },\n    { \"op\": \"text\", \"x\": 1, \"y\": 11, \"font\": \"5x7\", \"color\": \"#e0e0e0\", \"bind\": \"room.temp_c\" },\n    { \"op\": \"text\", \"x\": 24, \"y\": 11, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"C\" },\n    { \"op\": \"text\", \"x\": 1, \"y\": 23, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"RH\" },\n    { \"op\": \"text\", \"x\": 12, \"y\": 23, \"font\": \"3x5\", \"color\": \"#e0e0e0\", \"bind\": \"room.humidity\" },\n    { \"op\": \"text\", \"x\": 32, \"y\": 23, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"%\" }\n  ]\n}",
  },
  {
    slug: "calendar-next",
    name: "Calendar Next",
    priority: 65,
    dwellMs: 10000,
    source: "{\n  \"id\": \"calendar-next\",\n  \"name\": \"Calendar Next\",\n  \"priority\": 78,\n  \"dwellMs\": 10000,\n  \"elements\": [\n    { \"op\": \"text\", \"x\": 1, \"y\": 3, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"NEXT\" },\n    { \"op\": \"text\", \"x\": 1, \"y\": 11, \"font\": \"3x5\", \"color\": \"#e0e0e0\", \"bind\": \"calendar.next.title\" },\n    { \"op\": \"text\", \"x\": 1, \"y\": 23, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"IN\" },\n    { \"op\": \"text\", \"x\": 12, \"y\": 23, \"font\": \"3x5\", \"color\": \"#e0e0e0\", \"bind\": \"calendar.next.countdownMin\" },\n    { \"op\": \"text\", \"x\": 28, \"y\": 23, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"m\" }\n  ]\n}",
  },
  {
    slug: "self-status",
    name: "Self Status",
    priority: 20,
    dwellMs: 8000,
    source: "{\n  \"id\": \"self-status\",\n  \"name\": \"Self Status\",\n  \"priority\": 58,\n  \"dwellMs\": 8000,\n  \"elements\": [\n    { \"op\": \"text\", \"x\": 1, \"y\": 3, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"RSSI\" },\n    { \"op\": \"text\", \"x\": 18, \"y\": 3, \"font\": \"3x5\", \"color\": \"#e0e0e0\", \"bind\": \"telemetry.rssi\" },\n    { \"op\": \"text\", \"x\": 1, \"y\": 13, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"UP\" },\n    { \"op\": \"text\", \"x\": 18, \"y\": 13, \"font\": \"3x5\", \"color\": \"#e0e0e0\", \"bind\": \"telemetry.uptime_s\" },\n    { \"op\": \"text\", \"x\": 1, \"y\": 23, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"PRG\" },\n    { \"op\": \"text\", \"x\": 16, \"y\": 23, \"font\": \"3x5\", \"color\": \"#e0e0e0\", \"bind\": \"device.programVersion\" },\n    { \"op\": \"text\", \"x\": 31, \"y\": 23, \"font\": \"3x5\", \"color\": \"#8f9f8d\", \"value\": \"FW\" },\n    { \"op\": \"text\", \"x\": 41, \"y\": 23, \"font\": \"3x5\", \"color\": \"#e0e0e0\", \"bind\": \"device.fwVersion\" }\n  ]\n}",
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
