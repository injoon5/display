import { clamp } from "../util.js";

type SeoulBusConfig = {
  arsId: string;
  route: string;
  stopName: string;
  headsign: string;
};

export const seoulBusPlugin = {
  kind: "seoul.bus",
  async fetch(config: SeoulBusConfig) {
    const now = new Date();
    const phaseSeconds = (now.getMinutes() * 60 + now.getSeconds()) % (16 * 60);
    const etaMin = Math.floor((16 * 60 - phaseSeconds) / 60) % 16;
    const rushHour = [7, 8, 17, 18, 19].includes(now.getHours());
    const crowding = rushHour ? clamp(1 + (now.getMinutes() % 3), 0, 3) : clamp(now.getMinutes() % 3, 0, 2);

    return {
      route: config.route,
      arsId: config.arsId,
      stopName: config.stopName,
      headsign: config.headsign,
      eta_min: etaMin,
      next_eta_min: etaMin + 6 + (now.getMinutes() % 4),
      crowding,
      plate: `74Sa ${1100 + ((now.getHours() * 97 + now.getMinutes() * 11) % 7000)}`,
      urgent: etaMin <= 3,
      status: etaMin === 0 ? "arriving" : etaMin <= 3 ? "approaching" : "scheduled",
    };
  },
};
