import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, requireUser, isResponse, audit } from "@/lib/api";
import { isVehicleAvailable, priceFor, canModify, validateWindow } from "@/lib/booking";
import { emit } from "@/lib/events";

const schema = z.object({
  startTime: z.string().optional(),
  hours: z.number().int().min(1).max(24).optional(),
});

// PATCH /api/reservations/:id — modify date/duration (client, own only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser("CLIENT");
  if (isResponse(guard)) return guard;
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { vehicle: true },
  });
  if (!reservation || reservation.userId !== guard.user.id) return fail("Not found", 404);
  if (reservation.status !== "UPCOMING") return fail("This booking can no longer be modified.", 409);

  const check = canModify(reservation.startTime);
  if (!check.ok) return fail(check.reason!, 409);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input", 422);

  const start = parsed.data.startTime ? new Date(parsed.data.startTime) : reservation.startTime;
  const hours = parsed.data.hours ?? reservation.hours;
  const end = new Date(start.getTime() + hours * 3600_000);

  const windowCheck = validateWindow(start, hours);
  if (!windowCheck.ok) return fail(windowCheck.reason!, 422);

  if (!(await isVehicleAvailable(reservation.vehicleId, start, end, reservation.id)))
    return fail("The vehicle is not available for the new time.", 409);

  const updated = await prisma.reservation.update({
    where: { id },
    data: { startTime: start, endTime: end, hours, priceTotal: priceFor(reservation.vehicle.pricePerHour, hours) },
  });

  const notif = await prisma.notification.create({
    data: {
      userId: guard.user.id,
      type: "RENTAL_MODIFIED",
      title: "Booking modified",
      body: `${reservation.vehicle.code} • ${hours}h`,
      severity: "INFO",
    },
  });
  emit({ type: "notification", userId: guard.user.id, data: notif });
  await audit(guard.user.id, "RESERVATION_MODIFY", "Reservation", id);

  return ok({ reservation: updated });
}
