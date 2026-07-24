import { z } from "zod";

export const seoulBusSchema = z.object({
  crowding: z.number().int().min(0).max(3),
  eta_min: z.number().int(),
  next_eta_min: z.number().int().nullable(),
  plate: z.string().nullable().optional(),
  route: z.string()
});
