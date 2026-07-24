import { clamp, round } from "../util.js";

type KmaNowcastConfig = {
  district: string;
};

export const kmaNowcastPlugin = {
  kind: "kma.nowcast",
  async fetch(config: KmaNowcastConfig) {
    const now = new Date();
    const summer = now.getMonth() >= 5 && now.getMonth() <= 8;
    const chance = clamp(Math.round((summer ? 30 : 14) + Math.sin(((now.getMinutes() - 20) / 60) * Math.PI * 2) * 28), 0, 100);
    const precipMm = chance >= 55 ? round(0.2 + (chance - 55) / 18, 1) : 0;

    return {
      district: config.district,
      willRain: chance >= 50,
      chance,
      precipMm,
      startsInMin: chance >= 50 ? 10 + (now.getMinutes() % 25) : null,
      endsInMin: chance >= 50 ? 45 + (now.getMinutes() % 40) : null,
      summary: chance >= 50 ? "brief shower window over Seoul" : "no rain in the next hour",
    };
  },
};
