import { z } from "zod";

export const seoulBusSchema = z.object({
  crowding: z.number().int().min(0).max(3),
  eta_min: z.number().int(),
  eta2_min: z.number().int().optional(),
  eta3_min: z.number().int().optional(),
  headsign: z.string().optional(),
  next_eta_min: z.number().int().nullable(),
  next2_eta_min: z.number().int().nullable().optional(),
  next3_eta_min: z.number().int().nullable().optional(),
  plate: z.string().nullable().optional(),
  route: z.string(),
  urgent: z.boolean().optional()
});
