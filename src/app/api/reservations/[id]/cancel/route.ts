import { prisma } from "@/lib/db";
import { ok, fail, requireUser, isResponse, audit } from "@/lib/api";
import { canCancel } from "@/lib/booking";
import { emit } from "@/lib/events";

// POST /api/reservations/:id/cancel — client cancels own upcoming booking.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser("CLIENT");
  if (isResponse(guard)) return guard;
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { vehicle: true } });
  if (!reservation || reservation.userId !== guard.user.id) return fail("Not found", 404);
  if (reservation.status !== "UPCOMING") return fail("This booking can no longer be cancelled.", 409);

  const check = canCancel(reservation.startTime);
  if (!check.ok) return fail(check.reason!, 409);

  const updated = await prisma.reservation.update({ where: { id }, data: { status: "CANCELLED" } });

  const notif = await prisma.notification.create({
    data: {
      userId: guard.user.id,
      type: "RENTAL_CANCELLED",
      title: "Booking cancelled",
      body: `${reservation.vehicle.code} booking was cancelled.`,
      severity: "INFO",
    },
  });
  emit({ type: "notification", userId: guard.user.id, data: notif });
  await audit(guard.user.id, "RESERVATION_CANCEL", "Reservation", id);

  return ok({ reservation: updated });
}
