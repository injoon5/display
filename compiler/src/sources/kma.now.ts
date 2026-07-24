import { z } from "zod";

export const kmaNowSchema = z.object({
  condition: z.string(),
  feelsC: z.number().optional(),
  feels_c: z.number().optional(),
  icon: z.string(),
  rainProb: z.number().int().min(0).max(100).optional(),
  tempC: z.number(),
  temp_c: z.number().optional()
});
