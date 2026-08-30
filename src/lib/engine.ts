import { prisma } from "./db";
import { emit } from "./events";
import { analyzeVehicle, TelemetryPoint } from "./ai";
import { RentalContext } from "./ai/theft";
import { rules } from "./config";

const WINDOW = 40;

/** Map a raw telemetry row (DB or simulator) into an AI point. */
function toPoint(t: {
  timestamp: Date;
  temperature: number | null;
  voltage: number | null;
  soc: number | null;
  speed: number | null;
  latitude: number | null;
  longitude: number | null;
  bleSignal: number | null;
  gpsAvailable: boolean;
  bleAvailable: boolean;
}): TelemetryPoint {
  return {
    timestamp: t.timestamp.getTime(),
    temperature: t.temperature,
    voltage: t.voltage,
    soc: t.soc,
    speed: t.speed,
    lat: t.latitude,
    lng: t.longitude,
    bleSignal: t.bleSignal,
    gpsAvailable: t.gpsAvailable,
    bleAvailable: t.bleAvailable,
  };
}

/**
 * Analyze one vehicle from its recent telemetry, persist a RiskScore, and
 * create/refresh an Incident when the fuzzy decision warrants it.
 */
export async function evaluateVehicle(vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { battery: true },
  });
  if (!vehicle) return null;

  const rows = await prisma.telemetry.findMany({
    where: { vehicleId },
    orderBy: { timestamp: "desc" },
    take: WINDOW,
  });
  if (rows.length === 0) return null;
  const window = rows.reverse().map(toPoint);

  // Rental context for theft assessment.
  const rental = await prisma.rental.findFirst({
    where: { vehicleId, status: { in: ["ACTIVE", "ENDING_SOON", "EXPIRED", "OVERDUE"] } },
    orderBy: { createdAt: "desc" },
  });
  const ctx: RentalContext = {
    status: (rental?.status as RentalContext["status"]) ?? "NONE",
    expectedZone: { lat: vehicle.homeLat, lng: vehicle.homeLng },
    geofenceRadiusKm: rules.theft.geofenceRadiusKm,
  };

  const result = await analyzeVehicle(window, ctx);
  const { detection, decision } = result as ReturnType<typeof import("./ai").localAnalyze> & {
    source: string;
  };

  // Persist the risk snapshot.
  await prisma.riskScore.create({
    data: {
      vehicleId,
      batteryAnomaly: detection.battery.score,
      theftAnomaly: detection.theft.score,
      tamperAnomaly: detection.tamper.score,
      rentalViolation: detection.rentalViolation,
      overall: decision.overall,
      severity: decision.severity,
    },
  });
  emit({ type: "risk", vehicleCode: vehicle.code, data: { overall: decision.overall, severity: decision.severity } });

  // Update vehicle status flag.
  if (decision.severity === "CRITICAL" || decision.severity === "HIGH") {
    if (vehicle.status !== "MAINTENANCE") {
      await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: "AT_RISK" } });
      emit({ type: "vehicle-status", vehicleCode: vehicle.code, status: "AT_RISK" });
    }
  }

  // Create incident for meaningful risk (dedupe: don't spam identical open ones).
  if (decision.overall >= 45 && decision.driver !== "NONE") {
    await createIncident(vehicle, decision, detection);
  }

  return { vehicleCode: vehicle.code, decision, detection };
}

type Detection = ReturnType<typeof import("./ai").localAnalyze>["detection"];
type Decision = ReturnType<typeof import("./ai").localAnalyze>["decision"];

async function createIncident(
  vehicle: { id: string; code: string; battery: { code: string } | null },
  decision: Decision,
  detection: Detection
) {
  const map: Record<
    string,
    { type: string; title: string; pick: { explanation: string[]; recommended_action: string } }
  > = {
    BATTERY: {
      type: "BATTERY_ANOMALY",
      title: "Battery stress detected",
      pick: detection.battery,
    },
    THEFT: {
      type: "THEFT_RISK",
      title: detection.theft.label ?? "Possible unauthorized movement",
      pick: detection.theft,
    },
    TAMPERING: {
      type: "TAMPERING",
      title: detection.tamper.label ?? "Possible device tampering",
      pick: detection.tamper,
    },
    RENTAL: {
      type: "RENTAL_OVERDUE",
      title: "Return required",
      pick: {
        explanation: ["Rental time has passed and the vehicle has not been returned."],
        recommended_action: "Contact the client and locate the vehicle.",
      },
    },
  };
  const cfg = map[decision.driver];
  if (!cfg) return;

  // Deduplicate: refresh an existing open incident of the same type instead of stacking.
  const existing = await prisma.incident.findFirst({
    where: { vehicleId: vehicle.id, type: cfg.type, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
  });

  const data = {
    vehicleId: vehicle.id,
    batteryCode: vehicle.battery?.code,
    type: cfg.type,
    severity: decision.severity,
    riskScore: decision.overall,
    confidence:
      decision.driver === "BATTERY"
        ? detection.battery.confidence
        : decision.driver === "THEFT"
        ? detection.theft.confidence
        : decision.driver === "TAMPERING"
        ? detection.tamper.confidence
        : 0.9,
    title: cfg.title,
    explanation: cfg.pick.explanation.join(" "),
    technical: JSON.stringify({
      battery: detection.battery.score,
      theft: detection.theft.score,
      tamper: detection.tamper.score,
      rental: detection.rentalViolation,
      overall: decision.overall,
    }),
    action: cfg.pick.recommended_action,
    status: "OPEN",
  };

  let incident;
  if (existing) {
    incident = await prisma.incident.update({ where: { id: existing.id }, data });
  } else {
    incident = await prisma.incident.create({ data });
    // Notify all owners.
    const owners = await prisma.user.findMany({ where: { role: "OWNER" } });
    for (const o of owners) {
      const n = await prisma.notification.create({
        data: {
          userId: o.id,
          type: cfg.type,
          title: `${vehicle.code}: ${cfg.title}`,
          body: cfg.pick.explanation[0] ?? cfg.title,
          severity: decision.severity === "CRITICAL" || decision.severity === "HIGH" ? "CRITICAL" : "WARN",
        },
      });
      emit({ type: "notification", userId: o.id, data: n });
    }
  }
  emit({ type: "incident", severity: decision.severity, data: incident });
  return incident;
}
