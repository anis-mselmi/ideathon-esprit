import { prisma } from "./db";
import { rules } from "./config";

/** Check whether a vehicle is free for [start,end), excluding one reservation. */
export async function isVehicleAvailable(
  vehicleId: string,
  start: Date,
  end: Date,
  excludeReservationId?: string
): Promise<boolean> {
  // Overlap with other active reservations.
  const overlapRes = await prisma.reservation.findFirst({
    where: {
      vehicleId,
      status: "UPCOMING",
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
  if (overlapRes) return false;

  // Overlap with active/ongoing rentals.
  const overlapRental = await prisma.rental.findFirst({
    where: {
      vehicleId,
      status: { in: ["ACTIVE", "ENDING_SOON", "EXPIRED", "OVERDUE"] },
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
  return !overlapRental;
}

export function priceFor(pricePerHour: number, hours: number): number {
  return Math.round(pricePerHour * hours * 100) / 100;
}

/** Business-rule checks with human-readable reasons. */
export function canModify(startTime: Date, now = new Date()): { ok: boolean; reason?: string } {
  if (startTime.getTime() <= now.getTime())
    return { ok: false, reason: "Booking has already started." };
  const minsToStart = (startTime.getTime() - now.getTime()) / 60000;
  if (minsToStart < rules.booking.modifyCutoffMinutes)
    return { ok: false, reason: "Too close to the start time to modify." };
  return { ok: true };
}

export function canCancel(startTime: Date, now = new Date()): { ok: boolean; reason?: string } {
  if (startTime.getTime() <= now.getTime())
    return { ok: false, reason: "Booking has already started." };
  const minsToStart = (startTime.getTime() - now.getTime()) / 60000;
  if (minsToStart < rules.booking.cancelCutoffMinutes)
    return { ok: false, reason: "Too close to the start time to cancel." };
  return { ok: true };
}

export function validateWindow(start: Date, hours: number, now = new Date()): { ok: boolean; reason?: string } {
  if (Number.isNaN(start.getTime())) return { ok: false, reason: "Invalid date." };
  const minsToStart = (start.getTime() - now.getTime()) / 60000;
  if (minsToStart < rules.booking.minLeadMinutes)
    return { ok: false, reason: "Please book at least a little ahead of time." };
  if (hours < 1 || hours > rules.booking.maxHours)
    return { ok: false, reason: `Duration must be between 1 and ${rules.booking.maxHours} hours.` };
  return { ok: true };
}
