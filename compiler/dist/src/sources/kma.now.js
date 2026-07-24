import { z } from "zod";
export const kmaNowSchema = z.object({
    condition: z.string(),
    feels_c: z.number(),
    icon: z.string(),
    temp_c: z.number()
});
//# sourceMappingURL=kma.now.js.map