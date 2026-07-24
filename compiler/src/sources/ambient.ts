import { z } from "zod";

export const ambientScopeSchema = z.object({
  device: z.object({
    bed_occupied: z.boolean(),
    brightness: z.number().int(),
    lux: z.number().int(),
    online: z.boolean(),
    presence: z.boolean(),
    rssi: z.number().int(),
    uptime_s: z.number().int()
  }),
  now: z.object({
    day: z.number().int(),
    dow: z.number().int(),
    hour: z.number().int(),
    minute: z.number().int(),
    month: z.number().int(),
    second: z.number().int(),
    ts: z.number().int(),
    year: z.number().int()
  }),
  room: z.object({
    humidity: z.number(),
    temp_c: z.number()
  }),
  scene: z.string(),
  weekday: z.boolean(),
  weekend: z.boolean()
});
