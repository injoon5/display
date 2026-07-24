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
        countdownMin: 42,
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
    slug: "air",
    name: "Air Quality",
    priority: 72,
    dwellMs: 9000,
    source: "<card id=\"air\" name=\"Air Quality\" priority=\"72\">\n  <source id=\"air\" kind=\"airkorea\" station=\"Gangnam-gu\" every=\"10m\" />\n  <text x=\"2\" y=\"0\" font=\"5x7\" color=\"#8f9f8d\">PM2.5</text>\n  <text x=\"2\" y=\"9\" font=\"8x16\" color=\"#f0f0f0\">{{ air.pm25 }}</text>\n  <text x=\"40\" y=\"13\" font=\"5x7\" color=\"#8f9f8d\">ug</text>\n  <text x=\"2\" y=\"25\" font=\"5x7\" color=\"{{ air.grade == 'good' ? '#52d6a7' : '#ffb020' }}\">{{ air.grade | upper | trunc(10) }}</text>\n  <stale after=\"20m\" style=\"dim\" />\n</card>",
  },
  {
    slug: "bus-402",
    name: "Bus",
    priority: 90,
    dwellMs: 9000,
    source: "<card id=\"bus-402\" name=\"Bus\" priority=\"90\">\n  <source id=\"bus\" kind=\"seoul.bus\" arsId=\"23-005\" route=\"402\" every=\"20s\" />\n  <text x=\"2\" y=\"2\" font=\"5x7\" color=\"#f0a030\">402</text>\n  <text x=\"28\" y=\"2\" font=\"5x7\" color=\"#f0f0f0\">{{ bus.eta_min }}'</text>\n  <text x=\"47\" y=\"2\" font=\"5x7\" color=\"#7c8a86\">{{ bus.next_eta_min | default('--') }}'</text>\n  <text x=\"2\" y=\"13\" font=\"5x7\" color=\"#52d6a7\">146</text>\n  <text x=\"28\" y=\"13\" font=\"5x7\" color=\"#f0f0f0\">{{ bus.eta2_min | default('--') }}'</text>\n  <text x=\"47\" y=\"13\" font=\"5x7\" color=\"#7c8a86\">{{ bus.next2_eta_min | default('--') }}'</text>\n  <text x=\"2\" y=\"24\" font=\"5x7\" color=\"#6fb1ff\">6411</text>\n  <text x=\"28\" y=\"24\" font=\"5x7\" color=\"#f0f0f0\">{{ bus.eta3_min | default('--') }}'</text>\n  <text x=\"47\" y=\"24\" font=\"5x7\" color=\"#7c8a86\">{{ bus.next3_eta_min | default('--') }}'</text>\n  <stale after=\"90s\" style=\"dim\" />\n</card>",
  },
  {
    slug: "calendar-next",
    name: "Calendar Next",
    priority: 78,
    dwellMs: 9000,
    source: "<card id=\"calendar-next\" name=\"Calendar Next\" priority=\"78\">\n  <source id=\"calendar\" kind=\"google.calendar\" calendarId=\"primary\" every=\"5m\" />\n  <text x=\"2\" y=\"0\" font=\"5x7\" color=\"#b07cff\">NEXT</text>\n  <text x=\"2\" y=\"11\" font=\"5x7\" color=\"#f0f0f0\">{{ calendar.next.title | trunc(10) }}</text>\n  <when test=\"{{ calendar.next.countdownMin != null }}\">\n    <text x=\"2\" y=\"24\" font=\"5x7\" color=\"#8f9f8d\">IN</text>\n    <text x=\"17\" y=\"24\" font=\"5x7\" color=\"#f0f0f0\">{{ calendar.next.countdownMin }}</text>\n    <text x=\"41\" y=\"24\" font=\"5x7\" color=\"#8f9f8d\">min</text>\n  </when>\n  <when test=\"{{ calendar.next.countdownMin == null }}\">\n    <text x=\"2\" y=\"24\" font=\"5x7\" color=\"#8f9f8d\">{{ calendar.next.startsAt | default('TBD') }}</text>\n  </when>\n  <stale after=\"15m\" style=\"dim\" />\n</card>",
  },
  {
    slug: "clock-dim",
    name: "Clock Dim",
    priority: 40,
    dwellMs: 15000,
    source: "<card id=\"clock-dim\" name=\"Clock Dim\" priority=\"40\">\n  <text x=\"3\" y=\"9\" font=\"8x16\" color=\"#66706a\">{{ now.hhmm | default('00:00') }}</text>\n  <stale after=\"2m\" style=\"dim\" />\n</card>",
  },
  {
    slug: "clock",
    name: "Clock",
    priority: 64,
    dwellMs: 10000,
    source: "<card id=\"clock\" name=\"Clock\" priority=\"64\">\n  <text x=\"3\" y=\"9\" font=\"8x16\" color=\"#f0f0f0\">{{ now.hhmm | default('00:00') }}</text>\n  <stale after=\"2m\" style=\"dim\" />\n</card>",
  },
  {
    slug: "dday",
    name: "D-Day",
    priority: 53,
    dwellMs: 9000,
    source: "<card id=\"dday\" name=\"D-Day\" priority=\"53\">\n  <text x=\"2\" y=\"1\" font=\"5x7\" color=\"#ff6b5c\">{{ dday.label }}</text>\n  <text x=\"2\" y=\"13\" font=\"5x7\" color=\"#f0f0f0\">D-</text>\n  <text x=\"15\" y=\"9\" font=\"8x16\" color=\"#f0f0f0\">{{ dday.days }}</text>\n  <text x=\"2\" y=\"25\" font=\"5x7\" color=\"#8f9f8d\">DAYS LEFT</text>\n</card>",
  },
  {
    slug: "fireplace",
    name: "Fireplace",
    priority: 50,
    dwellMs: 9000,
    source: "<card id=\"fireplace\" name=\"Fireplace\" priority=\"50\">\n  <fx kind=\"fire\" />\n</card>",
  },
  {
    slug: "github",
    name: "GitHub",
    priority: 51,
    dwellMs: 9000,
    source: "<card id=\"github\" name=\"GitHub\" priority=\"51\">\n  <text x=\"2\" y=\"1\" font=\"5x7\" color=\"#f0f0f0\">{{ gh.total }}</text>\n  <text x=\"34\" y=\"1\" font=\"5x7\" color=\"#52d6a7\">{{ gh.streak }}d</text>\n  <fx kind=\"grass\" x=\"2\" y=\"9\" w=\"60\" h=\"21\" color=\"#39d353\" />\n</card>",
  },
  {
    slug: "indoor",
    name: "Indoor",
    priority: 68,
    dwellMs: 9000,
    source: "<card id=\"indoor\" name=\"Indoor\" priority=\"68\">\n  <text x=\"2\" y=\"0\" font=\"5x7\" color=\"#e0913a\">ROOM</text>\n  <text x=\"2\" y=\"9\" font=\"8x16\" color=\"#f0f0f0\">{{ room.temp_c | round }}</text>\n  <text x=\"28\" y=\"13\" font=\"5x7\" color=\"#8f9f8d\">C</text>\n  <text x=\"2\" y=\"25\" font=\"5x7\" color=\"#8f9f8d\">RH</text>\n  <text x=\"17\" y=\"25\" font=\"5x7\" color=\"#f0f0f0\">{{ room.humidity | round }}</text>\n  <text x=\"31\" y=\"25\" font=\"5x7\" color=\"#8f9f8d\">%</text>\n  <stale after=\"5m\" style=\"dim\" />\n</card>",
  },
  {
    slug: "krw",
    name: "KRW/USD",
    priority: 54,
    dwellMs: 9000,
    source: "<card id=\"krw\" name=\"KRW/USD\" priority=\"54\">\n  <text x=\"2\" y=\"0\" font=\"8x16\" color=\"#f0f0f0\">{{ krw.rate }}</text>\n  <text x=\"2\" y=\"15\" font=\"3x5\" color=\"#8f9f8d\">KRW</text>\n  <text x=\"18\" y=\"15\" font=\"3x5\" color=\"#4ec98a\">+0.4%</text>\n  <fx kind=\"graph\" x=\"0\" y=\"20\" w=\"64\" h=\"12\" color=\"#4ec98a\" arg=\"1\" />\n</card>",
  },
  {
    slug: "life",
    name: "Life",
    priority: 50,
    dwellMs: 9000,
    source: "<card id=\"life\" name=\"Life\" priority=\"50\">\n  <fx kind=\"life\" color=\"#8fd0ff\" />\n</card>",
  },
  {
    slug: "matrix",
    name: "Matrix",
    priority: 50,
    dwellMs: 9000,
    source: "<card id=\"matrix\" name=\"Matrix\" priority=\"50\">\n  <fx kind=\"matrix\" color=\"#39ff88\" />\n</card>",
  },
  {
    slug: "moon",
    name: "Moon",
    priority: 55,
    dwellMs: 9000,
    source: "<card id=\"moon\" name=\"Moon\" priority=\"55\">\n  <fx kind=\"moon\" x=\"19\" y=\"0\" w=\"26\" h=\"26\" arg=\"160\" />\n  <text x=\"1\" y=\"1\" font=\"5x7\" color=\"#c9d4ff\">{{ moon.illum }}%</text>\n  <marquee x=\"2\" y=\"25\" w=\"60\" font=\"5x7\" color=\"#8f9f8d\" speed=\"16\">{{ moon.name }}</marquee>\n</card>",
  },
  {
    slug: "now-playing",
    name: "Now Playing",
    priority: 70,
    dwellMs: 12000,
    source: "<card id=\"now-playing\" name=\"Now Playing\" priority=\"70\">\n  <frect x=\"2\" y=\"5\" w=\"3\" h=\"2\" color=\"#52d6a7\" />\n  <frect x=\"4\" y=\"1\" w=\"1\" h=\"5\" color=\"#52d6a7\" />\n  <frect x=\"4\" y=\"1\" w=\"3\" h=\"1\" color=\"#52d6a7\" />\n  <marquee x=\"10\" y=\"1\" w=\"53\" font=\"5x7\" color=\"#f0f0f0\" speed=\"24\">{{ np.title }}</marquee>\n  <marquee x=\"2\" y=\"13\" w=\"60\" font=\"5x7\" color=\"#a9b3b0\" speed=\"18\">{{ np.artist }}</marquee>\n  <frect x=\"2\" y=\"25\" w=\"4\" h=\"4\" color=\"#52d6a7\" />\n  <marquee x=\"9\" y=\"24\" w=\"54\" font=\"5x7\" color=\"#7c8a86\" speed=\"16\">{{ np.ago }}</marquee>\n  <stale after=\"5m\" style=\"dim\" />\n</card>",
  },
  {
    slug: "rain-fx",
    name: "Rain",
    priority: 50,
    dwellMs: 9000,
    source: "<card id=\"rain-fx\" name=\"Rain\" priority=\"50\">\n  <fx kind=\"rain\" color=\"#8fb8ff\" arg=\"55\" />\n</card>",
  },
  {
    slug: "self-status",
    name: "Self Status",
    priority: 58,
    dwellMs: 9000,
    source: "<card id=\"self-status\" name=\"Self Status\" priority=\"58\">\n  <source id=\"telemetry\" kind=\"panel.telemetry\" every=\"60s\" />\n  <source id=\"device\" kind=\"panel.device\" every=\"60s\" />\n  <text x=\"2\" y=\"0\" font=\"5x7\" color=\"#8f9f8d\">RSSI</text>\n  <text x=\"27\" y=\"0\" font=\"5x7\" color=\"#f0f0f0\">{{ telemetry.rssi }}</text>\n  <text x=\"2\" y=\"8\" font=\"5x7\" color=\"#8f9f8d\">UP</text>\n  <text x=\"20\" y=\"8\" font=\"5x7\" color=\"#f0f0f0\">{{ telemetry.uptime_s | default(0) | duration }}</text>\n  <text x=\"2\" y=\"16\" font=\"5x7\" color=\"#8f9f8d\">PRG</text>\n  <text x=\"26\" y=\"16\" font=\"5x7\" color=\"#f0f0f0\">{{ device.programVersion }}</text>\n  <text x=\"2\" y=\"24\" font=\"5x7\" color=\"#8f9f8d\">FW</text>\n  <text x=\"20\" y=\"24\" font=\"5x7\" color=\"#f0f0f0\">{{ device.fwVersion | trunc(6) }}</text>\n  <stale after=\"3m\" style=\"dim\" />\n</card>",
  },
  {
    slug: "starfield",
    name: "Warp",
    priority: 50,
    dwellMs: 9000,
    source: "<card id=\"starfield\" name=\"Warp\" priority=\"50\">\n  <fx kind=\"starfield\" color=\"#a9c7ff\" />\n</card>",
  },
  {
    slug: "todo",
    name: "Todo",
    priority: 50,
    dwellMs: 9000,
    source: "<card id=\"todo\" name=\"Todo\" priority=\"50\">\n  <text x=\"2\" y=\"1\" font=\"5x7\" color=\"#f5c451\">TODO</text>\n  <text x=\"28\" y=\"1\" font=\"5x7\" color=\"#8f9f8d\">{{ todo.done }}/{{ todo.total }}</text>\n  <frect x=\"2\" y=\"9\" w=\"6\" h=\"6\" color=\"#4ec98a\" />\n  <marquee x=\"11\" y=\"9\" w=\"51\" font=\"5x7\" color=\"#7c8a86\" speed=\"14\">{{ todo.i1 }}</marquee>\n  <rect x=\"2\" y=\"17\" w=\"6\" h=\"6\" color=\"#5a6b66\" />\n  <marquee x=\"11\" y=\"17\" w=\"51\" font=\"5x7\" color=\"#f0f0f0\" speed=\"14\">{{ todo.i2 }}</marquee>\n  <rect x=\"2\" y=\"25\" w=\"6\" h=\"6\" color=\"#5a6b66\" />\n  <marquee x=\"11\" y=\"25\" w=\"51\" font=\"5x7\" color=\"#f0f0f0\" speed=\"14\">{{ todo.i3 }}</marquee>\n</card>",
  },
  {
    slug: "upcoming-weather",
    name: "Forecast",
    priority: 60,
    dwellMs: 9000,
    source: "<card id=\"upcoming-weather\" name=\"Forecast\" priority=\"60\">\n  <text x=\"4\"  y=\"0\" font=\"5x7\" color=\"#8f9f8d\">15h</text>\n  <text x=\"25\" y=\"0\" font=\"5x7\" color=\"#8f9f8d\">17h</text>\n  <text x=\"46\" y=\"0\" font=\"5x7\" color=\"#8f9f8d\">19h</text>\n  <fx kind=\"wxicon\" x=\"1\"  y=\"7\" w=\"19\" h=\"12\" arg=\"0\" />\n  <fx kind=\"wxicon\" x=\"22\" y=\"7\" w=\"19\" h=\"12\" arg=\"2\" />\n  <fx kind=\"wxicon\" x=\"44\" y=\"7\" w=\"19\" h=\"12\" arg=\"3\" />\n  <text x=\"4\"  y=\"20\" font=\"5x7\" color=\"#f0f0f0\">24</text>\n  <text x=\"25\" y=\"20\" font=\"5x7\" color=\"#f0f0f0\">22</text>\n  <text x=\"46\" y=\"20\" font=\"5x7\" color=\"#f0f0f0\">19</text>\n  <text x=\"3\"  y=\"27\" font=\"3x5\" color=\"#6fa8ff\">0%</text>\n  <text x=\"24\" y=\"27\" font=\"3x5\" color=\"#6fa8ff\">20%</text>\n  <text x=\"45\" y=\"27\" font=\"3x5\" color=\"#6fa8ff\">60%</text>\n</card>",
  },
  {
    slug: "weather",
    name: "Weather",
    priority: 76,
    dwellMs: 9000,
    source: "<card id=\"weather\" name=\"Weather\" priority=\"76\">\n  <source id=\"wx\" kind=\"kma.now\" station=\"Seoul-108\" every=\"10m\" />\n  <text x=\"2\" y=\"0\" font=\"5x7\" color=\"#6fb1ff\">NOW</text>\n  <text x=\"2\" y=\"9\" font=\"8x16\" color=\"#f0f0f0\">{{ wx.tempC | round }}</text>\n  <text x=\"28\" y=\"13\" font=\"5x7\" color=\"#8f9f8d\">C</text>\n  <text x=\"2\" y=\"25\" font=\"5x7\" color=\"#8f9f8d\">{{ wx.condition | upper | trunc(10) }}</text>\n  <when test=\"{{ wx.icon == 0 }}\"><fx kind=\"wxicon\" x=\"43\" y=\"1\" w=\"20\" h=\"18\" arg=\"0\" /></when>\n  <when test=\"{{ wx.icon == 1 }}\"><fx kind=\"wxicon\" x=\"43\" y=\"1\" w=\"20\" h=\"18\" arg=\"1\" /></when>\n  <when test=\"{{ wx.icon == 2 }}\"><fx kind=\"wxicon\" x=\"43\" y=\"1\" w=\"20\" h=\"18\" arg=\"2\" /></when>\n  <when test=\"{{ wx.icon == 3 }}\"><fx kind=\"wxicon\" x=\"43\" y=\"1\" w=\"20\" h=\"18\" arg=\"3\" /></when>\n  <when test=\"{{ wx.icon == 4 }}\"><fx kind=\"wxicon\" x=\"43\" y=\"1\" w=\"20\" h=\"18\" arg=\"4\" /></when>\n  <when test=\"{{ wx.icon == 5 }}\"><fx kind=\"wxicon\" x=\"43\" y=\"1\" w=\"20\" h=\"18\" arg=\"5\" /></when>\n  <when test=\"{{ wx.icon == 6 }}\"><fx kind=\"wxicon\" x=\"43\" y=\"1\" w=\"20\" h=\"18\" arg=\"6\" /></when>\n  <when test=\"{{ wx.icon == 7 }}\"><fx kind=\"wxicon\" x=\"43\" y=\"1\" w=\"20\" h=\"18\" arg=\"7\" /></when>\n  <stale after=\"20m\" style=\"dim\" />\n</card>",
  },
  {
    slug: "year-progress",
    name: "Year",
    priority: 52,
    dwellMs: 9000,
    source: "<card id=\"year-progress\" name=\"Year\" priority=\"52\">\n  <text x=\"2\" y=\"1\" font=\"5x7\" color=\"#b07cff\">{{ now.year }}</text>\n  <text x=\"40\" y=\"1\" font=\"5x7\" color=\"#8f9f8d\">D{{ year.day }}</text>\n  <text x=\"2\" y=\"9\" font=\"8x16\" color=\"#f0f0f0\">{{ year.pct }}</text>\n  <text x=\"30\" y=\"13\" font=\"5x7\" color=\"#8f9f8d\">%</text>\n  <bar x=\"2\" y=\"26\" w=\"60\" h=\"4\" bg=\"#2a2438\" color=\"#b07cff\" value=\"{{ year.pct }}\" max=\"100\" />\n</card>",
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
