import { compile } from "$lib/compiler";
import airCard from "../../../../cards/air.json";
import bus402Card from "../../../../cards/bus-402.json";
import calendarNextCard from "../../../../cards/calendar-next.json";
import clockDimCard from "../../../../cards/clock-dim.json";
import clockCard from "../../../../cards/clock.json";
import indoorCard from "../../../../cards/indoor.json";
import selfStatusCard from "../../../../cards/self-status.json";
import weatherCard from "../../../../cards/weather.json";
import type {
  DashboardCard,
  DashboardDiagnostic,
  DashboardDevice,
  DashboardFirmware,
  DashboardRule,
  DashboardScene,
  DashboardSource,
  DashboardState,
  SourceOrigin,
} from "./types";

type FixtureCardSource = {
  dwellMs?: number;
  id: string;
  name?: string;
  priority?: number;
};

const CARD_FIXTURES: FixtureCardSource[] = [
  bus402Card,
  weatherCard,
  airCard,
  clockCard,
  clockDimCard,
  indoorCard,
  calendarNextCard,
  selfStatusCard,
];

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

function buildCard(source: FixtureCardSource, nowMs: number): DashboardCard {
  const compiled = compile(source);
  const sourceString = JSON.stringify(source, null, 2);
  return {
    _creationTime: nowMs,
    _id: `card-${source.id}`,
    diagnostics: mapDiagnostics(compiled.diagnostics),
    dwellMs: source.dwellMs ?? 10_000,
    enabled: true,
    estimatedAmps: compiled.estimatedAmps,
    name: source.name ?? source.id,
    priority: source.priority ?? 50,
    slug: source.id,
    slotMap: compiled.slotMap,
    source: sourceString,
    sourceRefs: compiled.sources,
    updatedAt: nowMs,
  };
}

function buildScene(
  id: string,
  name: string,
  cardIds: string[],
  homekitIdentifier: number,
  brightnessCeiling: number,
  creationTime: number,
  schedule?: string,
): DashboardScene {
  return {
    _creationTime: creationTime,
    _id: id,
    brightnessCeiling,
    cardIds,
    enabled: true,
    homekitIdentifier,
    name,
    schedule,
  };
}

function buildSource(
  id: string,
  sourceId: string,
  kind: string,
  config: Record<string, unknown>,
  intervalMs: number,
  origin: SourceOrigin,
  creationTime: number,
  fetchedAt: number,
  data: Record<string, unknown>,
): DashboardSource {
  return {
    _creationTime: creationTime,
    _id: id,
    config,
    consecutiveFailures: 0,
    data,
    fetchedAt,
    intervalMs,
    kind,
    origin,
    sourceId,
  };
}

export function createSeedState(nowMs = Date.now()): DashboardState {
  const cards = CARD_FIXTURES.map((source, index) => buildCard(source, nowMs - index * 1_000));
  const sceneByName = {
    away: "scene-away",
    day: "scene-day",
    evening: "scene-evening",
    morning: "scene-morning",
    night: "scene-night",
  } as const;

  return {
    cards,
    devices: [
      {
        _creationTime: nowMs - 1_000,
        _id: "device-demo",
        activeSceneId: sceneByName.day,
        dataEtag: "\"seed-data\"",
        dataVersion: 12,
        fwChannel: "stable",
        fwVersion: "1.4.2",
        lastSeen: nowMs,
        name: "Wall Matrix Panel Demo",
        online: true,
        programEtag: "\"seed-program\"",
        programVersion: 7,
        tokenHash: "demo-token",
      },
    ],
    firmware: [
      {
        _creationTime: nowMs - 10 * 24 * 60 * 60 * 1_000,
        _id: "fw-1.4.2",
        channel: "stable",
        r2Url: "https://example.invalid/fw/matrix-1.4.2.bin",
        releasedAt: nowMs - 10 * 24 * 60 * 60 * 1_000,
        sha256: "f5d4384ce980dce2b70351f8e4dc5df1",
        signature: "ed25519:demo",
        version: "1.4.2",
      },
      {
        _creationTime: nowMs - 3 * 24 * 60 * 60 * 1_000,
        _id: "fw-1.5.0-rc1",
        channel: "dev",
        r2Url: "https://example.invalid/fw/matrix-1.5.0-rc1.bin",
        releasedAt: nowMs - 3 * 24 * 60 * 60 * 1_000,
        sha256: "65d4384ce980dce2b70351f8e4dc5cab",
        signature: "ed25519:demo",
        version: "1.5.0-rc1",
      },
    ],
    rules: [
      {
        _creationTime: nowMs - 2_000,
        _id: "rule-bus-urgent",
        action: { cardId: "card-bus-402", durationMs: 60_000, kind: "pin" },
        condition: "bus.urgent == true",
        enabled: true,
        name: "bus urgent",
        priority: 100,
      },
      {
        _creationTime: nowMs - 2_000,
        _id: "rule-air-alert",
        action: { cardId: "card-air", durationMs: 45_000, kind: "interrupt" },
        condition: "air.alert == true",
        enabled: true,
        name: "air alert",
        priority: 95,
      },
      {
        _creationTime: nowMs - 2_000,
        _id: "rule-night",
        action: { kind: "scene", sceneId: sceneByName.night },
        condition: "time.hour >= 22 or time.hour < 6",
        enabled: true,
        name: "sleep",
        priority: 70,
      },
      {
        _creationTime: nowMs - 2_000,
        _id: "rule-away",
        action: { kind: "scene", sceneId: sceneByName.away },
        condition: "indoor.presenceRoom == false and time.hour >= 8",
        enabled: true,
        name: "room empty",
        priority: 60,
      },
    ],
    scenes: [
      buildScene(
        "scene-morning",
        "morning",
        ["card-bus-402", "card-weather", "card-calendar-next", "card-air"],
        1,
        90,
        nowMs - 1_500,
        "weekday 06:30-09:30",
      ),
      buildScene("scene-day", "day", ["card-weather", "card-indoor", "card-calendar-next", "card-self-status"], 2, 100, nowMs - 1_400),
      buildScene("scene-evening", "evening", ["card-clock", "card-weather", "card-indoor", "card-self-status"], 3, 65, nowMs - 1_300),
      buildScene("scene-night", "night", ["card-clock-dim"], 4, 15, nowMs - 1_200, "everyday 22:00-23:59"),
      buildScene("scene-away", "away", ["card-self-status", "card-air"], 5, 40, nowMs - 1_100),
    ],
    sources: [
      buildSource("source-bus", "bus", "seoul.bus", { route: "402", arsId: "23-005" }, 20_000, "oracle-icn", nowMs - 4_500, nowMs - 4_000, {
        crowding: 2,
        eta_min: 4,
        headsign: "402번 강남역 방면",
        next_eta_min: 12,
        urgent: false,
      }),
      buildSource("source-wx", "wx", "kma.now", { station: "Seoul-108" }, 600_000, "oracle-icn", nowMs - 130_000, nowMs - 120_000, {
        condition: "humid cloudy",
        icon: "cloud",
        rainProb: 30,
        tempC: 27.4,
      }),
      buildSource("source-air", "air", "airkorea", { station: "Gangnam-gu" }, 600_000, "oracle-icn", nowMs - 285_000, nowMs - 280_000, {
        alert: false,
        grade: "good",
        pm10: 31,
        pm25: 18,
      }),
      buildSource("source-calendar", "calendar", "google.calendar", { calendarId: "primary" }, 300_000, "convex", nowMs - 43_000, nowMs - 42_000, {
        dateLabel: "Fri 24 Jul",
        next: {
          startsAt: "19:30",
          title: "Dinner in Seongsu",
        },
      }),
      buildSource("source-spotify", "spotify", "spotify.nowPlaying", { account: "demo" }, 15_000, "convex", nowMs - 7_000, nowMs - 6_000, {
        artist: "Balming Tiger",
        isPlaying: true,
        track: "Seoul",
      }),
      buildSource("source-github", "github", "github.repo", { repo: "injoon5/display" }, 600_000, "convex", nowMs - 325_000, nowMs - 320_000, {
        failingChecks: 0,
        latest: "Convex backend bootstrap",
        openPullRequests: 2,
      }),
      buildSource("source-indoor", "indoor", "panel.indoor", { room: "bedroom" }, 60_000, "convex", nowMs - 6_000, nowMs - 5_000, {
        humidity: 51.2,
        presenceBed: false,
        presenceRoom: true,
        tempC: 24.1,
      }),
      buildSource("source-poke", "poke", "panel.debug", { scope: "editor" }, 30_000, "convex", nowMs - 2_500, nowMs - 2_000, {
        message: "preview synced",
      }),
    ],
    telemetry: {
      at: nowMs,
      brightness: 62,
      estAmps: 0.84,
      governorActive: false,
      heapFree: 183_000,
      humidity: 51.2,
      lux: 128,
      presenceBed: false,
      presenceRoom: true,
      rssi: -54,
      tempC: 24.1,
    },
  };
}
