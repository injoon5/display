import { clamp, round, seasonalBaseTemp } from "../util.js";

type KmaForecastConfig = {
  station: string;
};

export const kmaForecastPlugin = {
  kind: "kma.forecast",
  async fetch(config: KmaForecastConfig) {
    const now = new Date();
    const summer = now.getMonth() >= 5 && now.getMonth() <= 8;
    const hourly = Array.from({ length: 6 }, (_, index) => {
      const hour = (now.getHours() + index * 3) % 24;
      const angle = ((hour - 15) / 24) * Math.PI * 2;
      const tempC = round(seasonalBaseTemp(now.getMonth()) + Math.cos(angle) * 4.8 + (summer ? 1 : -0.2), 1);
      const rainProb = clamp(Math.round((summer ? 32 : 16) + Math.sin(angle + index * 0.4) * 24), 0, 100);
      return {
        hour,
        tempC,
        rainProb,
        condition: rainProb >= 65 ? "rain" : rainProb >= 40 ? "cloudy" : "fair",
      };
    });

    return {
      station: config.station,
      summary: summer ? "humid with late showers" : "mixed cloud with a mild breeze",
      todayHighC: Math.max(...hourly.map((entry) => entry.tempC)),
      todayLowC: Math.min(...hourly.map((entry) => entry.tempC)),
      hourly,
    };
  },
};
