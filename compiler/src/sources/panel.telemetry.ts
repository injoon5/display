import { z } from "zod";

export const panelTelemetrySchema = z.object({
  brightness: z.number().int().optional(),
  estAmps: z.number().optional(),
  governorActive: z.boolean().optional(),
  heapFree: z.number().int().optional(),
  humidity: z.number().optional(),
  lux: z.number().int().optional(),
  presenceRoom: z.boolean().optional(),
  rssi: z.number().int(),
  tempC: z.number().optional(),
  uptime_s: z.number().int().optional()
});
