import { clamp } from "../util.js";

type AirKoreaConfig = {
  station: string;
};

function gradeForPm25(pm25: number): "good" | "moderate" | "bad" | "very-bad" {
  if (pm25 <= 15) {
    return "good";
  }
  if (pm25 <= 35) {
    return "moderate";
  }
  if (pm25 <= 75) {
    return "bad";
  }
  return "very-bad";
}

function gradeForPm10(pm10: number): "good" | "moderate" | "bad" | "very-bad" {
  if (pm10 <= 30) {
    return "good";
  }
  if (pm10 <= 80) {
    return "moderate";
  }
  if (pm10 <= 150) {
    return "bad";
  }
  return "very-bad";
}

export const airKoreaPlugin = {
  kind: "airkorea",
  async fetch(config: AirKoreaConfig) {
    const now = new Date();
    const pm25 = clamp(Math.round(12 + Math.sin((now.getHours() / 24) * Math.PI * 2) * 14 + (now.getMonth() <= 2 ? 10 : 0)), 6, 92);
    const pm10 = clamp(pm25 + 12 + (now.getMinutes() % 18), 18, 168);
    const pm25Grade = gradeForPm25(pm25);
    const pm10Grade = gradeForPm10(pm10);
    const grade = pm25Grade === "very-bad" || pm10Grade === "very-bad" ? "very-bad" : pm25Grade === "bad" || pm10Grade === "bad" ? "bad" : pm25Grade === "moderate" || pm10Grade === "moderate" ? "moderate" : "good";

    return {
      station: config.station,
      pm10,
      pm25,
      pm10Grade,
      pm25Grade,
      grade,
      alert: grade === "bad" || grade === "very-bad",
    };
  },
};
