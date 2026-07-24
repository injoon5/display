import { z } from "zod";
export declare const seoulBusSchema: z.ZodObject<{
    crowding: z.ZodNumber;
    eta_min: z.ZodNumber;
    headsign: z.ZodOptional<z.ZodString>;
    next_eta_min: z.ZodNullable<z.ZodNumber>;
    plate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    route: z.ZodString;
    urgent: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
