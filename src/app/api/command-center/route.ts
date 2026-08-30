import { prisma } from "@/lib/db";
import { ok, requireUser, isResponse } from "@/lib/api";

const SEV_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

// GET /api/command-center — owner fleet overview + prioritized incidents.
export async function GET() {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;

  const [vehicles, incidents, activeRentals, aiHealth] = await Promise.all([
    prisma.vehicle.groupBy({ by: ["status"], _count: true }),
    prisma.incident.findMany({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      include: { vehicle: { select: { code: true } } },
      take: 50,
    }),
    prisma.rental.findMany({
      where: { status: { in: ["ACTIVE", "ENDING_SOON", "EXPIRED", "OVERDUE"] } },
      include: {
        vehicle: { select: { code: true, model: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { endTime: "asc" },
      take: 20,
    }),
    // Cheap AI-liveness probe: did any risk score get written recently?
    prisma.riskScore.count({ where: { createdAt: { gte: new Date(Date.now() - 60_000) } } }),
  ]);

  const overview = {
    total: vehicles.reduce((a, v) => a + v._count, 0),
    available: count(vehicles, "AVAILABLE"),
    rented: count(vehicles, "RENTED"),
    maintenance: count(vehicles, "MAINTENANCE"),
    atRisk: count(vehicles, "AT_RISK"),
    offline: count(vehicles, "OFFLINE"),
  };

  incidents.sort(
    (a, b) =>
      (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0) ||
      b.riskScore - a.riskScore ||
      b.createdAt.getTime() - a.createdAt.getTime()
  );

  return ok({ overview, incidents, activeRentals, aiOnline: true, aiRecent: aiHealth });
}

function count(groups: { status: string; _count: number }[], status: string): number {
  return groups.find((g) => g.status === status)?._count ?? 0;
}
