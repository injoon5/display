import { z } from "zod";
export const airKoreaSchema = z.object({
    grade: z.number().int().min(1).max(4),
    pm10: z.number().int(),
    pm25: z.number().int()
});
//# sourceMappingURL=airkorea.js.map