import { prisma } from "@/lib/db";
import { ok, requireUser, isResponse } from "@/lib/api";

export async function GET() {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  const hubs = await prisma.hub.findMany({
    include: { batteries: { select: { id: true, code: true, status: true, soh: true, soc: true } } },
    orderBy: { name: "asc" },
  });
  return ok({ hubs });
}
