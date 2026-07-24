import { z } from "zod";
export declare const panelTelemetrySchema: z.ZodObject<{
    brightness: z.ZodOptional<z.ZodNumber>;
    estAmps: z.ZodOptional<z.ZodNumber>;
    governorActive: z.ZodOptional<z.ZodBoolean>;
    heapFree: z.ZodOptional<z.ZodNumber>;
    humidity: z.ZodOptional<z.ZodNumber>;
    lux: z.ZodOptional<z.ZodNumber>;
    presenceBed: z.ZodOptional<z.ZodBoolean>;
    presenceRoom: z.ZodOptional<z.ZodBoolean>;
    rssi: z.ZodNumber;
    tempC: z.ZodOptional<z.ZodNumber>;
    uptime_s: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
