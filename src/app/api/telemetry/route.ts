import { prisma } from "@/lib/db";
import { ok, fail, requireUser, isResponse } from "@/lib/api";
import { ingestTelemetry, EspTelemetry } from "@/lib/telemetry";

// POST /api/telemetry — ingestion endpoint. A real ESP32 posts the same shape.
// (In dev this is open to authenticated owners / simulator; in production a
// device token would authenticate hardware.)
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as EspTelemetry | null;
  if (!body || !body.vehicleCode) return fail("Invalid telemetry", 422);
  try {
    const row = await ingestTelemetry(body);
    return ok({ id: row.id });
  } catch (e) {
    return fail((e as Error).message ?? "Ingestion failed", 400);
  }
}

// GET /api/telemetry?vehicleId= — recent telemetry for charts (owner only).
export async function GET(req: Request) {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  const vehicleId = new URL(req.url).searchParams.get("vehicleId");
  if (!vehicleId) return fail("vehicleId required", 400);
  const rows = await prisma.telemetry.findMany({
    where: { vehicleId },
    orderBy: { timestamp: "desc" },
    take: 40,
  });
  return ok({ telemetry: rows.reverse() });
}
