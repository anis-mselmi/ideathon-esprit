import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, requireUser, isResponse, audit } from "@/lib/api";

const schema = z.object({ status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input", 422);

  const incident = await prisma.incident.update({ where: { id }, data: { status: parsed.data.status } });

  // Clear the vehicle AT_RISK flag when its incidents are all resolved.
  if (parsed.data.status === "RESOLVED" && incident.vehicleId) {
    const open = await prisma.incident.count({
      where: { vehicleId: incident.vehicleId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    });
    if (open === 0) {
      const v = await prisma.vehicle.findUnique({ where: { id: incident.vehicleId } });
      if (v && v.status === "AT_RISK") {
        await prisma.vehicle.update({ where: { id: v.id }, data: { status: "AVAILABLE" } });
      }
    }
  }
  await audit(guard.user.id, "INCIDENT_UPDATE", "Incident", id, parsed.data);
  return ok({ incident });
}
