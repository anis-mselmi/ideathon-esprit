import { prisma } from "@/lib/db";
import { ok, requireUser, isResponse } from "@/lib/api";

// GET /api/insights — owner business metrics.
export async function GET() {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;

  const [vehicles, batteries, rentals, incidents] = await Promise.all([
    prisma.vehicle.findMany({ select: { status: true } }),
    prisma.battery.findMany({ select: { soh: true } }),
    prisma.rental.findMany({ select: { priceTotal: true, startTime: true, endTime: true, status: true } }),
    prisma.incident.groupBy({ by: ["type"], _count: true }),
  ]);

  const total = vehicles.length || 1;
  const rented = vehicles.filter((v) => v.status === "RENTED").length;
  const utilization = Math.round((rented / total) * 100);

  const revenue = rentals.reduce((a, r) => a + r.priceTotal, 0);
  const avgHealth = batteries.length
    ? Math.round(batteries.reduce((a, b) => a + b.soh, 0) / batteries.length)
    : 0;

  const durations = rentals.map((r) => (r.endTime.getTime() - r.startTime.getTime()) / 3600_000);
  const avgRentalHours = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : 0;

  // Battery health distribution buckets.
  const buckets = [
    { band: "80-100", count: batteries.filter((b) => b.soh >= 80).length },
    { band: "60-79", count: batteries.filter((b) => b.soh >= 60 && b.soh < 80).length },
    { band: "40-59", count: batteries.filter((b) => b.soh >= 40 && b.soh < 60).length },
    { band: "<40", count: batteries.filter((b) => b.soh < 40).length },
  ];

  const statusDist = ["AVAILABLE", "RENTED", "MAINTENANCE", "AT_RISK", "OFFLINE"].map((s) => ({
    status: s,
    count: vehicles.filter((v) => v.status === s).length,
  }));

  return ok({
    utilization,
    revenue: Math.round(revenue),
    avgHealth,
    avgRentalHours,
    rentalCount: rentals.length,
    batteryDistribution: buckets,
    statusDistribution: statusDist,
    incidentsByType: incidents.map((i) => ({ type: i.type, count: i._count })),
  });
}
