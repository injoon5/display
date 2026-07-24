/**
 * Canonical ambient + device runtime roots for Stage 0/1 slot paths.
 * Keep in sync with web/src/lib/dashboard/runtime-scope.ts
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
