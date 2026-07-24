import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("spotify", { seconds: 15 }, internal.sources.fetchOne, { id: "spotify" });
crons.interval("calendar", { minutes: 5 }, internal.sources.fetchOne, { id: "calendar" });
crons.interval("github", { minutes: 10 }, internal.sources.fetchOne, { id: "github" });
crons.interval("fx", { minutes: 30 }, internal.sources.fetchOne, { id: "fx" });

crons.interval("offline-check", { seconds: 30 }, internal.devices.markStale, {});
crons.interval("rules", { seconds: 10 }, internal.rules.evaluate, {});
crons.interval("scene-sched", { minutes: 1 }, internal.scenes.applySchedule, {});
crons.daily("prune-telemetry", { hourUTC: 18, minuteUTC: 0 }, internal.telemetry.prune, {});

export default crons;
