import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, requireUser, isResponse, audit } from "@/lib/api";

// GET /api/vehicles — owner: full fleet; client: only public available cards.
export async function GET(req: Request) {
  const guard = await requireUser();
  if (isResponse(guard)) return guard;
  const { user } = guard;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  if (user.role === "OWNER") {
    const vehicles = await prisma.vehicle.findMany({
      where: status && status !== "ALL" ? { status } : undefined,
      include: { battery: true },
      orderBy: { code: "asc" },
    });
    return ok({ vehicles });
  }

  // Client view: only safe public fields for available vehicles.
  const vehicles = await prisma.vehicle.findMany({
    where: { status: "AVAILABLE" },
    select: {
      id: true, code: true, model: true, imageUrl: true, rangeKm: true,
      pricePerHour: true, status: true, battery: { select: { soc: true } },
    },
    orderBy: { code: "asc" },
  });
  return ok({ vehicles });
}

const createSchema = z.object({
  code: z.string().min(2),
  model: z.string().min(1),
  voltageClass: z.number().int().default(48),
  rangeKm: z.number().int().default(60),
  pricePerHour: z.number().default(10),
  homeLat: z.number().default(36.8065),
  homeLng: z.number().default(10.1815),
});

// POST /api/vehicles — owner only.
export async function POST(req: Request) {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input", 422);
  const existing = await prisma.vehicle.findUnique({ where: { code: parsed.data.code } });
  if (existing) return fail("A vehicle with this code already exists.", 409);
  const vehicle = await prisma.vehicle.create({ data: parsed.data });
  await audit(guard.user.id, "VEHICLE_CREATE", "Vehicle", vehicle.id);
  return ok({ vehicle });
}
