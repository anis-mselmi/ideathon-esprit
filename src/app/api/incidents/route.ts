import { prisma } from "@/lib/db";
import { ok, requireUser, isResponse } from "@/lib/api";

const SEV_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

// GET /api/incidents — owner only, prioritized (severity then risk then recency).
export async function GET(req: Request) {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  const status = new URL(req.url).searchParams.get("status") ?? "OPEN";

  const incidents = await prisma.incident.findMany({
    where: status === "ALL" ? undefined : { status: { in: status.split(",") } },
    include: { vehicle: { select: { code: true, homeLat: true, homeLng: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  incidents.sort(
    (a, b) =>
      (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0) ||
      b.riskScore - a.riskScore ||
      b.createdAt.getTime() - a.createdAt.getTime()
  );

  return ok({ incidents });
}
