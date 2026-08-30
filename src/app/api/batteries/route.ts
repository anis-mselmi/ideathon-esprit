import { prisma } from "@/lib/db";
import { ok, requireUser, isResponse } from "@/lib/api";

// GET /api/batteries — owner only. Optional ?status= filter.
export async function GET(req: Request) {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  const status = new URL(req.url).searchParams.get("status");

  const batteries = await prisma.battery.findMany({
    where: status && status !== "ALL" ? { status } : undefined,
    include: {
      hub: { select: { name: true } },
      vehicles: { select: { code: true } },
    },
    orderBy: { code: "asc" },
  });
  return ok({ batteries });
}
