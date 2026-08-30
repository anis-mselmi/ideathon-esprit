import { z } from "zod";
import { ok, fail, requireUser, isResponse } from "@/lib/api";
import { startSim, stopSim, stepOnce, trigger, setOffline, status, loadFleet } from "@/lib/sim-manager";
import { Scenario } from "@/lib/simulator";

// GET /api/sim — current simulator status (owner only).
export async function GET() {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  await loadFleet();
  return ok(status());
}

const schema = z.object({
  action: z.enum(["start", "stop", "step", "trigger", "offline"]),
  scenario: z
    .enum([
      "NORMAL", "LOW_BATTERY", "OVERHEATING", "VOLTAGE_ANOMALY", "BATTERY_DEGRADATION",
      "GPS_LOSS", "BLE_LOSS", "TAMPERING", "SUSPICIOUS_MOVEMENT", "THEFT_RISK",
    ])
    .optional(),
  vehicleCode: z.string().optional(),
  offline: z.boolean().optional(),
  intervalMs: z.number().optional(),
});

// POST /api/sim — control the simulator (owner only).
export async function POST(req: Request) {
  const guard = await requireUser("OWNER");
  if (isResponse(guard)) return guard;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input", 422);
  const { action, scenario, vehicleCode, offline, intervalMs } = parsed.data;

  switch (action) {
    case "start":
      return ok(await startSim(intervalMs));
    case "stop":
      return ok(stopSim());
    case "step":
      return ok(await stepOnce());
    case "trigger":
      if (!scenario) return fail("scenario required", 422);
      return ok(await trigger(scenario as Scenario, vehicleCode));
    case "offline":
      if (!vehicleCode) return fail("vehicleCode required", 422);
      return ok(setOffline(vehicleCode, offline ?? true));
  }
}
