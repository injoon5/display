import { z } from "zod";

export const googleCalendarSchema = z.object({
  dateLabel: z.string().optional(),
  next: z.object({
    countdownMin: z.number().int().optional(),
    startsAt: z.string().optional(),
    title: z.string()
  })
});
