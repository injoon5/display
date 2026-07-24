import { z } from "zod";
export declare const kmaNowSchema: z.ZodObject<{
    condition: z.ZodString;
    feelsC: z.ZodOptional<z.ZodNumber>;
    feels_c: z.ZodOptional<z.ZodNumber>;
    icon: z.ZodString;
    rainProb: z.ZodOptional<z.ZodNumber>;
    tempC: z.ZodNumber;
    temp_c: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
