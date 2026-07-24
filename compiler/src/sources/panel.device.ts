import { z } from "zod";

export const panelDeviceSchema = z.object({
  fwVersion: z.string(),
  lastSeen: z.number().optional(),
  name: z.string().optional(),
  online: z.boolean().optional(),
  programVersion: z.number().int()
});
