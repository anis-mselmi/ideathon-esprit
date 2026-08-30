import { prisma } from "@/lib/db";
import { ok, requireUser, isResponse } from "@/lib/api";
import { loadFleet, trigger, stepOnce, startSim } from "@/lib/sim-manager";
import { sweepRentals } from "@/lib/rental-monitor";
import { emit } from "@/lib/events";

/**
 * POST /api/sim/full-demo — orchestrates the end-to-end demonstration from the
 * spec: battery overheating on one vehicle, an expiring rental on another that
 * then moves suspiciously and loses signal (theft + tampering). Runs a few
 * simulation steps so the AI generates incidents, then leaves the fleet in an
 * "attention needed" state ready to investigate + resolve live.
 */
export async function POST() {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;

  await loadFleet();

  // 1) Battery overheating on EV-014 (or first available).
  const overheatVehicle = "EV-014";
  await trigger("OVERHEATING", overheatVehicle);

  // 2) Force an expiring rental on EV-007: make it active & already past end.
  const ev007 = await prisma.vehicle.findUnique({ where: { code: "EV-007" } });
  if (ev007) {
    const existing = await prisma.rental.findFirst({
      where: { vehicleId: ev007.id, status: { in: ["ACTIVE", "ENDING_SOON", "EXPIRED"] } },
    });
    const start = new Date(Date.now() - 5 * 3600_000);
    const end = new Date(Date.now() - 60 * 60 * 1000); // ended an hour ago
    if (existing) {
      await prisma.rental.update({ where: { id: existing.id }, data: { startTime: start, endTime: end, status: "ACTIVE" } });
    } else {
      const client = await prisma.user.findFirst({ where: { role: "CLIENT" } });
      if (client) {
        await prisma.rental.create({
          data: {
            userId: client.id,
            vehicleId: ev007.id,
            startTime: start,
            endTime: end,
            status: "ACTIVE",
            priceTotal: ev007.pricePerHour * 4,
          },
        });
      }
    }
    await prisma.vehicle.update({ where: { id: ev007.id }, data: { status: "RENTED" } });
    // 3) Vehicle keeps moving suspiciously and then loses signal.
    await trigger("THEFT_RISK", "EV-007");
  }

  // Run several steps so telemetry accumulates and the AI reacts.
  for (let i = 0; i < 6; i++) {
    await stepOnce();
    await sweepRentals();
  }

  // Keep the simulation running so the dashboards stay live.
  await startSim(3000);

  emit({ type: "incident", severity: "CRITICAL", data: { demo: true } });

  const incidents = await prisma.incident.count({ where: { status: "OPEN" } });
  return ok({ ok: true, message: "Full demo scenario triggered.", openIncidents: incidents });
}
