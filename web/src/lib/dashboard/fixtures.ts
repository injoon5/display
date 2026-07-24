import { compile } from "$lib/compiler";
import airCard from "../../../../cards/air.card?raw";
import bus402Card from "../../../../cards/bus-402.card?raw";
import calendarNextCard from "../../../../cards/calendar-next.card?raw";
import clockDimCard from "../../../../cards/clock-dim.card?raw";
import clockCard from "../../../../cards/clock.card?raw";
import indoorCard from "../../../../cards/indoor.card?raw";
import selfStatusCard from "../../../../cards/self-status.card?raw";
import weatherCard from "../../../../cards/weather.card?raw";
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

type FixtureCard = {
  dwellMs: number;
  name: string;
  priority: number;
  slug: string;
  source: string;
};

const CARD_FIXTURES: FixtureCard[] = [
  { slug: "bus-402", name: "Bus", priority: 90, dwellMs: 9_000, source: bus402Card },
  { slug: "weather", name: "Weather", priority: 80, dwellMs: 9_000, source: weatherCard },
  { slug: "air", name: "Air Quality", priority: 72, dwellMs: 9_000, source: airCard },
  { slug: "clock", name: "Clock", priority: 64, dwellMs: 10_000, source: clockCard },
  { slug: "clock-dim", name: "Clock Dim", priority: 40, dwellMs: 15_000, source: clockDimCard },
  { slug: "indoor", name: "Indoor", priority: 68, dwellMs: 9_000, source: indoorCard },
  { slug: "calendar-next", name: "Calendar Next", priority: 78, dwellMs: 9_000, source: calendarNextCard },
  { slug: "self-status", name: "Self Status", priority: 55, dwellMs: 9_000, source: selfStatusCard },
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

function buildCard(fixture: FixtureCard, nowMs: number): DashboardCard {
  const compiled = compile(fixture.source);
  return {
    _creationTime: nowMs,
    _id: `card-${fixture.slug}`,
    diagnostics: mapDiagnostics(compiled.diagnostics),
    dwellMs: fixture.dwellMs,
    enabled: true,
    estimatedAmps: compiled.estimatedAmps,
    name: fixture.name,
    priority: fixture.priority,
    slug: fixture.slug,
    slotMap: compiled.slotMap,
    source: fixture.source,
    sourceRefs: compiled.sources,
    updatedAt: nowMs,
  };
}

function buildScene(
  id: string,
  name: string,
  homekitIdentifier: number,
  cardIds: string[],
  nowMs: number,
  brightnessCeiling: number,
  schedule?: string,
): DashboardScene {
  return {
    _creationTime: nowMs,
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
  fetchedAt: number,
  _creationTime: number,
  data: Record<string, unknown>,
): DashboardSource {
  return {
    _creationTime,
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
  const cards = CARD_FIXTURES.map((fixture) => buildCard(fixture, nowMs));
  const cardId = (slug: string) => cards.find((card) => card.slug === slug)?._id ?? `card-${slug}`;

  const scenes = [
    buildScene(
      "scene-morning",
      "morning",
      1,
      [cardId("bus-402"), cardId("weather"), cardId("calendar-next"), cardId("air")],
      nowMs,
      90,
      "weekday 06:30-09:30",
    ),
    buildScene(
      "scene-day",
      "day",
      2,
      [cardId("weather"), cardId("indoor"), cardId("calendar-next"), cardId("self-status")],
      nowMs,
      100,
    ),
    buildScene(
      "scene-evening",
      "evening",
      3,
      [cardId("clock"), cardId("weather"), cardId("indoor"), cardId("self-status")],
      nowMs,
      65,
    ),
    buildScene("scene-night", "night", 4, [cardId("clock-dim")], nowMs, 15, "everyday 22:00-23:59"),
    buildScene("scene-away", "away", 5, [cardId("self-status"), cardId("air")], nowMs, 40),
  ];

  const device: DashboardDevice = {
    _creationTime: nowMs,
    _id: "device-demo",
    activeSceneId: "scene-day",
    brightnessCeiling: 100,
    dataEtag: '"fixture-data"',
    dataVersion: 1,
    fwChannel: "stable",
    fwVersion: "1.4.2",
    lastSeen: nowMs,
    name: "Wall Matrix Panel Demo",
    online: true,
    playlistCardIds: scenes[1]?.cardIds,
    programEtag: '"fixture-program"',
    programVersion: 1,
    tokenHash: "fixture",
  };

  const rules: DashboardRule[] = [
    {
      _creationTime: nowMs,
      _id: "rule-bus",
      action: { cardId: cardId("bus-402"), durationMs: 60_000, kind: "pin" },
      condition: "bus.urgent == true",
      enabled: true,
      name: "bus urgent",
      priority: 100,
    },
    {
      _creationTime: nowMs,
      _id: "rule-air",
      action: { cardId: cardId("air"), durationMs: 45_000, kind: "interrupt" },
      condition: "air.alert == true",
      enabled: true,
      name: "air alert",
      priority: 95,
    },
    {
      _creationTime: nowMs,
      _id: "rule-sleep",
      action: { kind: "scene", sceneId: "scene-night" },
      condition: "time.hour >= 22 or time.hour < 6",
      enabled: true,
      name: "sleep",
      priority: 70,
    },
    {
      _creationTime: nowMs,
      _id: "rule-empty",
      action: { kind: "scene", sceneId: "scene-away" },
      condition: "indoor.presenceRoom == false and time.hour >= 8",
      enabled: true,
      name: "room empty",
      priority: 60,
    },
  ];

  const firmware: DashboardFirmware[] = [
    {
      _creationTime: nowMs,
      _id: "fw-stable",
      channel: "stable",
      r2Url: "https://example.invalid/fw.bin",
      releasedAt: nowMs - 86_400_000,
      sha256: "abc123demo",
      signature: "ed25519:demo",
      version: "1.4.2",
    },
  ];

  return {
    cards,
    devices: [device],
    firmware,
    rules,
    scenes,
    sources: [
      buildSource(
        "source-bus",
        "bus",
        "seoul.bus",
        { arsId: "23-005", route: "402" },
        20_000,
        "oracle-icn",
        nowMs - 8_000,
        nowMs - 7_000,
        {
          crowding: 2,
          eta2_min: 8,
          eta3_min: 12,
          eta_min: 4,
          headsign: "402번 강남역 방면",
          next2_eta_min: 21,
          next3_eta_min: 27,
          next_eta_min: 12,
          route: "402",
          urgent: false,
        },
      ),
      buildSource(
        "source-wx",
        "wx",
        "kma.now",
        { station: "Seoul-108" },
        600_000,
        "oracle-icn",
        nowMs - 55_000,
        nowMs - 54_000,
        {
          condition: "humid cloudy",
          icon: "cloud",
          rainProb: 30,
          tempC: 27.4,
        },
      ),
      buildSource(
        "source-air",
        "air",
        "airkorea",
        { station: "Gangnam-gu" },
        600_000,
        "oracle-icn",
        nowMs - 61_000,
        nowMs - 60_000,
        {
          alert: false,
          grade: "good",
          pm10: 31,
          pm25: 18,
        },
      ),
      buildSource(
        "source-calendar",
        "calendar",
        "google.calendar",
        { calendarId: "primary" },
        300_000,
        "convex",
        nowMs - 43_000,
        nowMs - 42_000,
        {
          dateLabel: "Fri 24 Jul",
          next: {
            countdownMin: 42,
            startsAt: "19:30",
            title: "Dinner in Seongsu",
          },
        },
      ),
      buildSource(
        "source-spotify",
        "spotify",
        "spotify.nowPlaying",
        { account: "demo" },
        15_000,
        "convex",
        nowMs - 7_000,
        nowMs - 6_000,
        {
          ago: "NOW PLAYING",
          artist: "Balming Tiger",
          isPlaying: true,
          playing: true,
          title: "Seoul",
          track: "Seoul",
        },
      ),
      buildSource(
        "source-github",
        "github",
        "github.repo",
        { repo: "injoon5/display" },
        600_000,
        "convex",
        nowMs - 325_000,
        nowMs - 320_000,
        {
          contributionStreak: 47,
          contributions: 1284,
          failingChecks: 0,
          latest: "Convex backend bootstrap",
          openPullRequests: 2,
          streak: 47,
          total: 1284,
        },
      ),
      buildSource(
        "source-fx",
        "fx",
        "fx.usdkrw",
        { pair: "USD/KRW" },
        1_800_000,
        "convex",
        nowMs - 120_000,
        nowMs - 119_000,
        {
          changePct: 0.4,
          change_pct: 0.4,
          rate: 1384,
          usdKrw: 1384.2,
        },
      ),
      buildSource(
        "source-todo",
        "todo",
        "todo.list",
        { list: "personal" },
        300_000,
        "convex",
        nowMs - 40_000,
        nowMs - 39_000,
        {
          done: 2,
          i1: "Ship the display",
          i2: "Buy oat milk",
          i3: "Call mom",
          total: 5,
        },
      ),
      buildSource(
        "source-dday",
        "dday",
        "dday.countdown",
        { label: "EXAM" },
        3_600_000,
        "convex",
        nowMs - 80_000,
        nowMs - 79_000,
        {
          days: 128,
          label: "EXAM",
        },
      ),
      buildSource(
        "source-indoor",
        "indoor",
        "panel.indoor",
        { room: "bedroom" },
        60_000,
        "convex",
        nowMs - 6_000,
        nowMs - 5_000,
        {
          humidity: 51.2,
          presenceBed: false,
          presenceRoom: true,
          tempC: 24.1,
        },
      ),
      buildSource(
        "source-poke",
        "poke",
        "panel.debug",
        { scope: "editor" },
        30_000,
        "convex",
        nowMs - 2_500,
        nowMs - 2_000,
        {
          message: "preview synced",
        },
      ),
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
