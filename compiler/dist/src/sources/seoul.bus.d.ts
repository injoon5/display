import { z } from "zod";
export declare const seoulBusSchema: z.ZodObject<{
    crowding: z.ZodNumber;
    eta_min: z.ZodNumber;
    next_eta_min: z.ZodNullable<z.ZodNumber>;
    plate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    route: z.ZodString;
}, z.core.$strip>;
