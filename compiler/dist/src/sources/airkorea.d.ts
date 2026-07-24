import { z } from "zod";
export declare const airKoreaSchema: z.ZodObject<{
    alert: z.ZodOptional<z.ZodBoolean>;
    grade: z.ZodString;
    pm10: z.ZodNumber;
    pm25: z.ZodNumber;
}, z.core.$strip>;
