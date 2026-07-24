import { z } from "zod";
export declare const googleCalendarSchema: z.ZodObject<{
    dateLabel: z.ZodOptional<z.ZodString>;
    next: z.ZodObject<{
        countdownMin: z.ZodOptional<z.ZodNumber>;
        startsAt: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
