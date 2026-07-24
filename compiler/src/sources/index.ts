import { z } from "zod";

import { ambientScopeSchema } from "./ambient.js";
import { airKoreaSchema } from "./airkorea.js";
import { googleCalendarSchema } from "./google.calendar.js";
import { kmaNowSchema } from "./kma.now.js";
import { panelDeviceSchema } from "./panel.device.js";
import { panelTelemetrySchema } from "./panel.telemetry.js";
import { seoulBusSchema } from "./seoul.bus.js";

export interface SourcePlugin {
  kind: string;
  schema: z.ZodObject<z.ZodRawShape>;
}

export const sourcePlugins: Record<string, SourcePlugin> = {
  airkorea: {
    kind: "airkorea",
    schema: airKoreaSchema
  },
  "google.calendar": {
    kind: "google.calendar",
    schema: googleCalendarSchema
  },
  "kma.now": {
    kind: "kma.now",
    schema: kmaNowSchema
  },
  "panel.device": {
    kind: "panel.device",
    schema: panelDeviceSchema
  },
  "panel.telemetry": {
    kind: "panel.telemetry",
    schema: panelTelemetrySchema
  },
  "seoul.bus": {
    kind: "seoul.bus",
    schema: seoulBusSchema
  }
};

export { ambientScopeSchema };
