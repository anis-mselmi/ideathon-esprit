import { prisma } from "./db";
import { rules } from "./config";
import { emit } from "./events";

/**
 * Sweep active rentals and advance their lifecycle:
 * ACTIVE -> ENDING_SOON -> EXPIRED -> OVERDUE, emitting client + owner
 * notifications at each transition. Called by the sim loop and on-demand.
 */
export async function sweepRentals(now = new Date()) {
  const rentals = await prisma.rental.findMany({
    where: { status: { in: ["ACTIVE", "ENDING_SOON", "EXPIRED"] } },
    include: { vehicle: { select: { code: true } }, user: { select: { id: true, fullName: true } } },
  });

  for (const r of rentals) {
    const minsToEnd = (r.endTime.getTime() - now.getTime()) / 60000;
    const minsPastEnd = -minsToEnd;
    let next = r.status;

    if (minsPastEnd >= rules.overdueGraceMinutes) next = "OVERDUE";
    else if (minsPastEnd >= 0) next = "EXPIRED";
    else if (minsToEnd <= rules.rentalEndingWarningMinutes) next = "ENDING_SOON";

    if (next === r.status) continue;

    await prisma.rental.update({ where: { id: r.id }, data: { status: next } });

    if (next === "ENDING_SOON") {
      await notify(r.user.id, "RENTAL_ENDING", "Your rental ends soon", `Your rental ends in ${rules.rentalEndingWarningMinutes} minutes. Please plan to return the vehicle.`, "WARN");
    } else if (next === "EXPIRED") {
      await notify(r.user.id, "RENTAL_EXPIRED", "Your rental has ended", "Your rental has ended. Please return the vehicle.", "WARN");
    } else if (next === "OVERDUE") {
      await notify(r.user.id, "VEHICLE_OVERDUE", "Rental time exceeded", "Your rental time has been exceeded. Please return the vehicle.", "CRITICAL");
      // Notify owners: return required.
      const owners = await prisma.user.findMany({ where: { role: "OWNER" } });
      for (const o of owners) {
        await notify(
          o.id,
          "VEHICLE_OVERDUE",
          `${r.vehicle.code}: Return required`,
          `${r.user.fullName}'s rental has not been returned.`,
          "CRITICAL"
        );
      }
    }
  }
}

async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  severity: "INFO" | "WARN" | "CRITICAL"
) {
  const n = await prisma.notification.create({ data: { userId, type, title, body, severity } });
  emit({ type: "notification", userId, data: n });
}
