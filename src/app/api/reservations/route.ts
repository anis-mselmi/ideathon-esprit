import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, requireUser, isResponse, audit } from "@/lib/api";
import { isVehicleAvailable, priceFor, validateWindow } from "@/lib/booking";
import { emit } from "@/lib/events";

// GET /api/reservations — client: own; owner: all.
export async function GET() {
  const guard = await requireUser();
  if (isResponse(guard)) return guard;
  const where = guard.user.role === "OWNER" ? {} : { userId: guard.user.id };
  const reservations = await prisma.reservation.findMany({
    where,
    include: { vehicle: { select: { code: true, model: true, pricePerHour: true } } },
    orderBy: { startTime: "desc" },
  });
  return ok({ reservations });
}

const schema = z.object({
  vehicleId: z.string(),
  startTime: z.string(), // ISO
  hours: z.number().int().min(1).max(24),
  paymentMethod: z.enum(["ONLINE", "PAY_AT_SHOP"]).default("PAY_AT_SHOP"),
  // Identity (stored on user profile, minimal exposure).
  idType: z.enum(["CIN", "PASSPORT"]).optional(),
  idNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

// POST /api/reservations — clients create bookings.
export async function POST(req: Request) {
  const guard = await requireUser("CLIENT");
  if (isResponse(guard)) return guard;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input", 422);
  const { vehicleId, hours, paymentMethod, idType, idNumber, dateOfBirth } = parsed.data;

  const start = new Date(parsed.data.startTime);
  const end = new Date(start.getTime() + hours * 3600_000);

  const windowCheck = validateWindow(start, hours);
  if (!windowCheck.ok) return fail(windowCheck.reason!, 422);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return fail("Vehicle not found", 404);

  if (!(await isVehicleAvailable(vehicleId, start, end)))
    return fail("This vehicle is not available for the selected time.", 409);

  // Persist minimal identity on the profile (sensitive; owner-only exposure).
  if (idType && idNumber) {
    await prisma.user.update({
      where: { id: guard.user.id },
      data: {
        idType,
        idNumber,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      },
    });
  }

  const reservation = await prisma.reservation.create({
    data: {
      userId: guard.user.id,
      vehicleId,
      startTime: start,
      endTime: end,
      hours,
      priceTotal: priceFor(vehicle.pricePerHour, hours),
      paymentMethod,
      paymentStatus: paymentMethod === "ONLINE" ? "PAID" : "PENDING",
      status: "UPCOMING",
    },
  });

  if (paymentMethod === "ONLINE") {
    // Mock payment — never store raw card data.
    await prisma.payment.create({
      data: {
        reservationId: reservation.id,
        amount: reservation.priceTotal,
        method: "ONLINE",
        status: "PAID",
        reference: `MOCK-${reservation.id.slice(-8).toUpperCase()}`,
      },
    });
  }

  const notif = await prisma.notification.create({
    data: {
      userId: guard.user.id,
      type: "RENTAL_CREATED",
      title: "Booking confirmed",
      body: `${vehicle.code} • ${hours}h • ${reservation.priceTotal} DT`,
      severity: "INFO",
    },
  });
  emit({ type: "notification", userId: guard.user.id, data: notif });
  await audit(guard.user.id, "RESERVATION_CREATE", "Reservation", reservation.id);

  return ok({ reservation });
}
