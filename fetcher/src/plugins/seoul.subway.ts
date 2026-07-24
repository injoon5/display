import { clamp } from "../util.js";

type SeoulSubwayConfig = {
  line: string;
  station: string;
  direction: string;
};

export const seoulSubwayPlugin = {
  kind: "seoul.subway",
  async fetch(config: SeoulSubwayConfig) {
    const now = new Date();
    const phaseSeconds = (now.getMinutes() * 60 + now.getSeconds()) % (11 * 60);
    const etaMin = Math.floor((11 * 60 - phaseSeconds) / 60) % 11;
    const crowding = clamp(((now.getHours() + now.getMinutes()) % 4) + (config.line === "Line 2" ? 1 : 0), 0, 3);

    return {
      line: config.line,
      station: config.station,
      direction: config.direction,
      eta_min: etaMin,
      next_eta_min: etaMin + 4 + (now.getMinutes() % 3),
      crowding,
      destination: "Seongsu",
      platform: 2,
      express: false,
      status: etaMin <= 1 ? "boarding" : etaMin <= 4 ? "approaching" : "inbound",
    };
  },
};
