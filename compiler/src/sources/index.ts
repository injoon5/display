import { z } from "zod";

import { ambientScopeSchema } from "./ambient.js";
import { airKoreaSchema } from "./airkorea.js";
import { kmaNowSchema } from "./kma.now.js";
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
  "kma.now": {
    kind: "kma.now",
    schema: kmaNowSchema
  },
  "seoul.bus": {
    kind: "seoul.bus",
    schema: seoulBusSchema
  }
};

export { ambientScopeSchema };
