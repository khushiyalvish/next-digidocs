import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/features/auth/guards";
import { searchHseCodes } from "@/features/reference/queries";

/**
 * GET /api/hse-codes?q=… — the HSE code picker on the Add Import form's item rows: active codes
 * whose code starts with, or whose description contains, the text; the first page only. Reference
 * data, nothing personal; only Enterprise users fill in imports, so only they may ask (others 404).
 */

const querySchema = z.object({ q: z.string().trim().max(100).optional().catch(undefined) });

export async function GET(request: NextRequest) {
  await requireRole("enterprise");
  const { q } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const { codes } = await searchHseCodes({ q, page: 1, activeOnly: true });
  return NextResponse.json(
    codes.map((code) => ({
      id: code.id,
      code: code.hseCode,
      description: code.goodsDescription,
      duty: code.importDutyRate,
      levy: code.levyRate,
      excise: code.exciseRate,
      vat: code.vatRate,
    })),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
