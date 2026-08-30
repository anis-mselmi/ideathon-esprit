import { prisma } from "@/lib/db";
import { ok, requireUser, isResponse } from "@/lib/api";

// GET /api/rentals — owner: all (with client name + identity for verification);
// client: own rentals only (no other clients' data).
export async function GET() {
  const guard = await requireUser();
  if (isResponse(guard)) return guard;

  if (guard.user.role === "OWNER") {
    const rentals = await prisma.rental.findMany({
      include: {
        vehicle: { select: { code: true, model: true } },
        user: { select: { fullName: true, phone: true, idType: true, idNumber: true } },
      },
      orderBy: { startTime: "desc" },
      take: 100,
    });
    return ok({ rentals });
  }

  const rentals = await prisma.rental.findMany({
    where: { userId: guard.user.id },
    include: { vehicle: { select: { code: true, model: true } } },
    orderBy: { startTime: "desc" },
  });
  return ok({ rentals });
}
