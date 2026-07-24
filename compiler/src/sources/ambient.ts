import { z } from "zod";

export const ambientScopeSchema = z.object({
  device: z.object({
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
  np: z.object({
    title: z.string(),
    artist: z.string(),
    playing: z.boolean(),
    ago: z.string()
  }),
  moon: z.object({
    phase: z.number(),
    illum: z.number().int(),
    name: z.string()
  }),
  year: z.object({
    pct: z.number().int(),
    day: z.number().int(),
    remaining: z.number().int()
  }),
  dday: z.object({
    days: z.number().int(),
    label: z.string()
  }),
  krw: z.object({
    rate: z.number().int(),
    change_pct: z.number()
  }),
  gh: z.object({
    total: z.number().int(),
    streak: z.number().int()
  }),
  todo: z.object({
    total: z.number().int(),
    done: z.number().int(),
    i1: z.string(),
    i2: z.string(),
    i3: z.string()
  }),
  scene: z.string(),
  weekday: z.boolean(),
  weekend: z.boolean()
});
