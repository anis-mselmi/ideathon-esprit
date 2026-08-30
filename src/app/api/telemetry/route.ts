import { prisma } from "@/lib/db";
import { ok, fail, requireUser, isResponse } from "@/lib/api";
import { ingestTelemetry, EspTelemetry } from "@/lib/telemetry";

function authorizedDevice(req: Request) {
  const expected = process.env.IOT_INGEST_API_KEY;
  if (!expected) return false;
  const supplied = req.headers.get("x-iot-api-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return supplied === expected;
}

// POST /api/telemetry — ingestion endpoint. A real ESP32 posts the same shape.
export async function POST(req: Request) {
  if (!authorizedDevice(req)) return fail("Invalid or missing IoT API key", 401);
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
