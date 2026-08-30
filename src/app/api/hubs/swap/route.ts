import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, requireUser, isResponse, audit } from "@/lib/api";
import { emit } from "@/lib/events";

const schema = z.object({ vehicleId: z.string(), newBatteryId: z.string() });

/**
 * POST /api/hubs/swap — battery swap with full consistency enforcement.
 * Steps mirror the spec: verify current, verify replacement, compatibility,
 * not-already-assigned, health, assign, retire old, record history + audit.
 */
export async function POST(req: Request) {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input", 422);
  const { vehicleId, newBatteryId } = parsed.data;

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { battery: true } });
  if (!vehicle) return fail("Vehicle not found", 404);

  const newBattery = await prisma.battery.findUnique({ where: { id: newBatteryId } });
  if (!newBattery) return fail("Replacement battery not found", 404);

  // Consistency checks.
  if (newBattery.status === "ASSIGNED")
    return fail("That battery is already assigned to another vehicle.", 409);
  if (newBattery.voltageClass !== vehicle.voltageClass)
    return fail("Voltage class is not compatible with this vehicle.", 409);
  if (newBattery.soh < 40)
    return fail("Replacement battery health is too low to deploy.", 409);

  const oldBattery = vehicle.battery;

  await prisma.$transaction(async (tx) => {
    // Retire old assignment + battery.
    if (oldBattery) {
      await tx.batteryAssignment.updateMany({
        where: { vehicleId, batteryId: oldBattery.id, removedAt: null },
        data: { removedAt: new Date() },
      });
      await tx.battery.update({
        where: { id: oldBattery.id },
        data: { status: oldBattery.soh < 60 ? "SERVICE" : "READY" },
      });
    }
    // Assign new.
    await tx.vehicle.update({
      where: { id: vehicleId },
      data: { batteryId: newBattery.id, status: "AVAILABLE" },
    });
    await tx.battery.update({ where: { id: newBattery.id }, data: { status: "ASSIGNED" } });
    await tx.batteryAssignment.create({ data: { vehicleId, batteryId: newBattery.id } });
    await tx.maintenanceRecord.create({
      data: {
        vehicleId,
        batteryId: newBattery.id,
        kind: "BATTERY_SWAP",
        note: `Swapped ${oldBattery?.code ?? "—"} → ${newBattery.code}`,
      },
    });
  });

  await audit(guard.user.id, "BATTERY_SWAP", "Vehicle", vehicleId, {
    from: oldBattery?.code,
    to: newBattery.code,
  });
  emit({ type: "vehicle-status", vehicleCode: vehicle.code, status: "AVAILABLE" });

  return ok({ ok: true, vehicle: vehicle.code, newBattery: newBattery.code });
}
