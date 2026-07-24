import { clamp, hourAngle, round, seasonalBaseTemp } from "../util.js";

type KmaNowConfig = {
  station: string;
};

export const kmaNowPlugin = {
  kind: "kma.now",
  async fetch(config: KmaNowConfig) {
    const now = new Date();
    const summer = now.getMonth() >= 5 && now.getMonth() <= 8;
    const tempC = round(seasonalBaseTemp(now.getMonth()) + Math.cos(hourAngle(now)) * 4.2 + (summer ? 0.8 : -0.3), 1);
    const humidity = clamp(Math.round((summer ? 68 : 52) + Math.sin(hourAngle(now) + 0.8) * 14), 28, 96);
    const rainProb = clamp(Math.round((summer ? 35 : 18) + Math.sin(hourAngle(now) - 0.5) * 22), 0, 100);
    const condition =
      rainProb >= 70 ? "showers" : rainProb >= 45 ? "cloudy" : now.getHours() >= 19 || now.getHours() < 6 ? "clear night" : "sunny";

    return {
      station: config.station,
      tempC,
      feelsLikeC: round(tempC + (humidity >= 75 ? 1.6 : humidity <= 35 ? -1 : 0), 1),
      humidity,
      rainProb,
      windMps: round(1.4 + Math.abs(Math.sin(hourAngle(now))) * 2.8, 1),
      condition,
      icon: condition === "showers" ? "rain" : condition === "cloudy" ? "cloud" : condition === "clear night" ? "moon" : "sun",
    };
  },
};
