import { round } from "../util.js";

type KmaQuakeConfig = {
  region: string;
};

export const kmaQuakePlugin = {
  kind: "kma.quake",
  async fetch(config: KmaQuakeConfig) {
    const now = new Date();
    const minuteKey = Math.floor(now.getTime() / 60_000);
    const active = minuteKey % 173 === 0;

    if (!active) {
      return {
        region: config.region,
        magnitude: null,
        location: null,
        occurredAt: null,
        ageMin: null,
        felt: false,
      };
    }

    return {
      region: config.region,
      magnitude: round(2.6 + ((minuteKey % 11) / 10), 1),
      location: "38km SE of Gyeongju",
      occurredAt: new Date(now.getTime() - 2 * 60_000).toISOString(),
      ageMin: 2,
      felt: true,
    };
  },
};
