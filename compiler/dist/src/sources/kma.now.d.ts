import { z } from "zod";
export declare const kmaNowSchema: z.ZodObject<{
    condition: z.ZodString;
    feels_c: z.ZodNumber;
    icon: z.ZodString;
    temp_c: z.ZodNumber;
}, z.core.$strip>;
