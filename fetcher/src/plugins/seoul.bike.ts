import { clamp } from "../util.js";

type SeoulBikeConfig = {
  stationId: string;
  stationName: string;
  capacity: number;
};

export const seoulBikePlugin = {
  kind: "seoul.bike",
  async fetch(config: SeoulBikeConfig) {
    const now = new Date();
    const commutePull = [8, 9, 18, 19].includes(now.getHours()) ? 5 : 0;
    const bikesAvailable = clamp(config.capacity - 7 - (now.getMinutes() % 9) - commutePull, 1, config.capacity - 1);
    const docksAvailable = config.capacity - bikesAvailable;

    return {
      stationId: config.stationId,
      stationName: config.stationName,
      bikesAvailable,
      docksAvailable,
      utilization: Math.round((bikesAvailable / config.capacity) * 100),
      status: bikesAvailable <= 3 ? "low-bikes" : docksAvailable <= 3 ? "low-docks" : "healthy",
    };
  },
};
