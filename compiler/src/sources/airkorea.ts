import { z } from "zod";

export const airKoreaSchema = z.object({
  alert: z.boolean().optional(),
  grade: z.string(),
  pm10: z.number().int(),
  pm25: z.number().int()
});
