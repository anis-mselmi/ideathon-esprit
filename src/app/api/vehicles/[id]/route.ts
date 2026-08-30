import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, requireUser, isResponse, audit } from "@/lib/api";

// GET /api/vehicles/:id — owner: full detail incl. telemetry, locations, risk.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  const { id } = await params;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      battery: true,
      telemetry: { orderBy: { timestamp: "desc" }, take: 40 },
      locations: { orderBy: { timestamp: "desc" }, take: 20 },
      riskScores: { orderBy: { createdAt: "desc" }, take: 1 },
      rentals: { orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { fullName: true } } } },
      incidents: { where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } },
    },
  });
  if (!vehicle) return fail("Vehicle not found", 404);
  return ok({ vehicle });
}

const patchSchema = z.object({
  model: z.string().optional(),
  pricePerHour: z.number().optional(),
  rangeKm: z.number().int().optional(),
  status: z.enum(["AVAILABLE", "RENTED", "MAINTENANCE", "AT_RISK", "OFFLINE"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input", 422);
  const vehicle = await prisma.vehicle.update({ where: { id }, data: parsed.data });
  await audit(guard.user.id, "VEHICLE_UPDATE", "Vehicle", id, parsed.data);
  return ok({ vehicle });
}
