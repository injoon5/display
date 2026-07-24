import { z } from "zod";
export declare const airKoreaSchema: z.ZodObject<{
    grade: z.ZodNumber;
    pm10: z.ZodNumber;
    pm25: z.ZodNumber;
}, z.core.$strip>;
