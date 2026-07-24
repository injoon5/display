import { z } from "zod";
export declare const panelDeviceSchema: z.ZodObject<{
    fwVersion: z.ZodString;
    lastSeen: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    online: z.ZodOptional<z.ZodBoolean>;
    programVersion: z.ZodNumber;
}, z.core.$strip>;
