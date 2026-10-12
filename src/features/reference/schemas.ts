import { z } from "zod";

/** The HSE code search's address-bar filters. Anything malformed falls back to "no filter". */
export const hseSearchSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
