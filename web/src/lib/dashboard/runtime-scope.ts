/**
 * Canonical ambient + device runtime roots for Stage 0/1 slot paths.
 * Keep in sync with convex/lib/runtimeScope.ts
 */

export type RuntimeDevice = {
  name: string;
  fwVersion: string;
  programVersion: number;
  online: boolean;
  lastSeen: number;
};

export type RuntimeTelemetry = {
  rssi: number;
  heapFree: number;
  brightness: number;
  lux: number;
  tempC: number;
  humidity: number;
  presenceRoom: boolean;
  presenceBed: boolean;
  estAmps: number;
  governorActive: boolean;
  uptime_s?: number;
};

export type RuntimeSource = {
  sourceId: string;
  data: unknown;
  fetchedAt: number;
};

const SEOUL_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Seoul",
  weekday: "short",
  year: "numeric",
});

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function numberField(record: Record<string, unknown> | null, ...keys: string[]): number | undefined {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function stringField(record: Record<string, unknown> | null, ...keys: string[]): string | undefined {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

function booleanField(record: Record<string, unknown> | null, ...keys: string[]): boolean | undefined {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
}

function dayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 0);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86_400_000);
}

function daysInYear(year: number): number {
  return dayOfYear(year, 12, 31);
}

/** Synodic-month approximation for moon phase (0..1). */
function moonPhaseFraction(nowMs: number): number {
  const synodic = 29.53058867;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const days = (nowMs - knownNew) / 86_400_000;
  const phase = ((days % synodic) + synodic) % synodic;
  return phase / synodic;
}

function moonName(phase: number): string {
  if (phase < 0.03 || phase >= 0.97) return "NEW";
  if (phase < 0.22) return "WAXING CRESCENT";
  if (phase < 0.28) return "FIRST QUARTER";
  if (phase < 0.47) return "WAXING GIBBOUS";
  if (phase < 0.53) return "FULL";
  if (phase < 0.72) return "WANING GIBBOUS";
  if (phase < 0.78) return "LAST QUARTER";
  return "WANING CRESCENT";
}

function synthesizeAmbientRoots(
  root: Record<string, unknown>,
  clock: { day: number; month: number; year: number },
  nowMs: number,
): void {
  const spotify = asRecord(root.spotify);
  const npExisting = asRecord(root.np);
  const playing =
    booleanField(npExisting, "playing", "isPlaying") ??
    booleanField(spotify, "playing", "isPlaying") ??
    false;
  root.np = {
    ago: stringField(npExisting, "ago") ?? (playing ? "NOW PLAYING" : "PAUSED"),
    artist: stringField(npExisting, "artist") ?? stringField(spotify, "artist") ?? "—",
    playing,
    title:
      stringField(npExisting, "title", "track") ??
      stringField(spotify, "title", "track") ??
      "—",
  };

  const github = asRecord(root.github);
  const ghExisting = asRecord(root.gh);
  root.gh = {
    streak:
      numberField(ghExisting, "streak") ??
      numberField(github, "streak", "contributionStreak") ??
      0,
    total:
      numberField(ghExisting, "total", "contributions") ??
      numberField(github, "total", "contributions", "openPullRequests") ??
      0,
  };

  const fx = asRecord(root.fx) ?? asRecord(root.krw);
  const krwExisting = asRecord(root.krw);
  const rate =
    numberField(krwExisting, "rate", "usdKrw") ?? numberField(fx, "rate", "usdKrw") ?? 1380;
  root.krw = {
    change_pct:
      numberField(krwExisting, "change_pct", "changePct") ??
      numberField(fx, "change_pct", "changePct") ??
      0,
    rate: Math.round(rate),
  };

  const todoExisting = asRecord(root.todo);
  root.todo = {
    done: numberField(todoExisting, "done") ?? 0,
    i1: stringField(todoExisting, "i1") ?? "",
    i2: stringField(todoExisting, "i2") ?? "",
    i3: stringField(todoExisting, "i3") ?? "",
    total: numberField(todoExisting, "total") ?? 0,
  };

  const moonExisting = asRecord(root.moon);
  const phase = numberField(moonExisting, "phase") ?? moonPhaseFraction(nowMs);
  const illum =
    numberField(moonExisting, "illum") ?? Math.round((1 - Math.abs(phase * 2 - 1)) * 100);
  root.moon = {
    illum,
    name: stringField(moonExisting, "name") ?? moonName(phase),
    phase,
  };

  const yearExisting = asRecord(root.year);
  const yday = numberField(yearExisting, "day") ?? dayOfYear(clock.year, clock.month, clock.day);
  const totalDays = daysInYear(clock.year);
  const pct = numberField(yearExisting, "pct") ?? Math.min(100, Math.round((yday / totalDays) * 100));
  root.year = {
    day: yday,
    pct,
    remaining: numberField(yearExisting, "remaining") ?? Math.max(0, totalDays - yday),
  };

  const ddayExisting = asRecord(root.dday);
  root.dday = {
    days: numberField(ddayExisting, "days") ?? 0,
    label: stringField(ddayExisting, "label") ?? "D-DAY",
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function seoulParts(nowMs: number): {
  day: number;
  dow: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  weekday: string;
  year: number;
} {
  const parts = SEOUL_TIME_FORMATTER.formatToParts(new Date(nowMs));
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "0";

  const weekday = read("weekday");
  const dowByName: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    day: Number(read("day")),
    dow: dowByName[weekday] ?? 0,
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    month: Number(read("month")),
    second: Number(read("second")),
    weekday,
    year: Number(read("year")),
  };
}

export function buildRuntimeScope(input: {
  device?: RuntimeDevice | null;
  nowMs: number;
  sceneName?: string | null;
  sources: RuntimeSource[];
  telemetry?: RuntimeTelemetry | null;
  uptimeSeconds?: number;
}): Record<string, unknown> {
  const clock = seoulParts(input.nowMs);
  const weekday = clock.dow >= 1 && clock.dow <= 5;
  const indoor = input.sources.find((source) => source.sourceId === "indoor");
  const indoorData = asRecord(indoor?.data);
  const telemetry = input.telemetry ?? null;

  const root: Record<string, unknown> = Object.fromEntries(
    input.sources.map((source) => [source.sourceId, asRecord(source.data) ?? {}]),
  );

  root.now = {
    day: clock.day,
    dow: clock.dow,
    hhmm: `${pad2(clock.hour)}:${pad2(clock.minute)}`,
    hour: clock.hour,
    minute: clock.minute,
    month: clock.month,
    second: clock.second,
    ts: Math.floor(input.nowMs / 1000),
    year: clock.year,
  };

  // Rules and Stage 0 fixtures historically used `time.*`.
  root.time = {
    hour: clock.hour,
    minute: clock.minute,
    weekday: clock.weekday,
  };

  root.room = {
    humidity: numberField(indoorData, "humidity") ?? telemetry?.humidity ?? 0,
    temp_c: numberField(indoorData, "temp_c", "tempC") ?? telemetry?.tempC ?? 0,
  };

  if (input.device) {
    root.device = {
      fwVersion: input.device.fwVersion,
      lastSeen: input.device.lastSeen,
      name: input.device.name,
      online: input.device.online,
      programVersion: input.device.programVersion,
    };
  }

  root.telemetry = {
    brightness: telemetry?.brightness ?? 0,
    estAmps: telemetry?.estAmps ?? 0,
    governorActive: telemetry?.governorActive ?? false,
    heapFree: telemetry?.heapFree ?? 0,
    humidity: telemetry?.humidity ?? 0,
    lux: telemetry?.lux ?? 0,
    presenceBed: telemetry?.presenceBed ?? false,
    presenceRoom: telemetry?.presenceRoom ?? false,
    rssi: telemetry?.rssi ?? 0,
    tempC: telemetry?.tempC ?? 0,
    uptime_s: input.uptimeSeconds ?? telemetry?.uptime_s ?? 0,
  };

  root.weekday = weekday;
  root.weekend = !weekday;
  root.scene = input.sceneName ?? "";

  synthesizeAmbientRoots(root, clock, input.nowMs);

  return root;
}

export function getByPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    const record = asRecord(current);
    if (!record) {
      return null;
    }
    current = record[part];
  }
  return current ?? null;
}
