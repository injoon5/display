import { ambientScopeSchema } from "./ambient.js";
import { airKoreaSchema } from "./airkorea.js";
import { kmaNowSchema } from "./kma.now.js";
import { seoulBusSchema } from "./seoul.bus.js";
export const sourcePlugins = {
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
//# sourceMappingURL=index.js.map