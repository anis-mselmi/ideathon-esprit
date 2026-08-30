import { prisma } from "@/lib/db";
import { ok, requireUser, isResponse } from "@/lib/api";

// GET /api/tracking — owner map data: each vehicle's last known location,
// GPS confidence, status and latest theft risk.
export async function GET() {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;

  const vehicles = await prisma.vehicle.findMany({
    include: {
      locations: { orderBy: { timestamp: "desc" }, take: 1 },
      riskScores: { orderBy: { createdAt: "desc" }, take: 1 },
      rentals: { where: { status: { in: ["ACTIVE", "ENDING_SOON", "EXPIRED", "OVERDUE"] } }, take: 1 },
    },
  });
  const hubs = await prisma.hub.findMany();

  const points = vehicles.map((v) => {
    const loc = v.locations[0];
    const risk = v.riskScores[0];
    return {
      code: v.code,
      status: v.status,
      lat: loc?.lat ?? v.homeLat,
      lng: loc?.lng ?? v.homeLng,
      gpsConfidence: loc?.gpsConfidence ?? 0,
      lastUpdate: loc?.timestamp ?? null,
      theftRisk: risk?.theftAnomaly ?? 0,
      severity: risk?.severity ?? "LOW",
      rentalStatus: v.rentals[0]?.status ?? "NONE",
    };
  });

  return ok({ points, hubs: hubs.map((h) => ({ name: h.name, lat: h.lat, lng: h.lng })) });
}
