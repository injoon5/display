import { z } from "zod";
import { ambientScopeSchema } from "./ambient.js";
export interface SourcePlugin {
    kind: string;
    schema: z.ZodObject<z.ZodRawShape>;
}
export declare const sourcePlugins: Record<string, SourcePlugin>;
export { ambientScopeSchema };
