import { prisma } from "@/lib/db";
import { ok, fail, requireUser, isResponse } from "@/lib/api";
import { batterySoh, batteryRul } from "@/lib/ai";
import { mean, std } from "@/lib/ai/stats";

// GET /api/batteries/:id — full battery passport with AI SOH/RUL.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  const { id } = await params;

  const battery = await prisma.battery.findUnique({
    where: { id },
    include: {
      hub: true,
      vehicles: { select: { code: true } },
      readings: { orderBy: { timestamp: "desc" }, take: 60 },
      assignments: {
        orderBy: { assignedAt: "desc" },
        take: 10,
        include: { vehicle: { select: { code: true } } },
      },
      maintenance: { orderBy: { createdAt: "desc" }, take: 10 },
      predictions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!battery) return fail("Battery not found", 404);

  const temps = battery.readings.map((r) => r.temperature);
  const volts = battery.readings.map((r) => r.voltage);
  const anomalyCount = battery.predictions.filter((p) => p.kind === "battery-anomaly" && p.score > 55).length;

  const soh = batterySoh({
    cycleCount: battery.cycleCount,
    ageMonths: battery.ageMonths,
    avgTemp: temps.length ? mean(temps) : 32,
    voltInstability: volts.length ? std(volts) : 0.3,
    anomalyCount,
  });
  const rul = batteryRul(soh.score, battery.cycleCount);

  return ok({ battery, soh, rul });
}
