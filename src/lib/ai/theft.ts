import { AiResult, TelemetryPoint } from "./types";
import { clamp01, mean, std } from "./stats";
import { haversineKm, bearing } from "./geo";
import { severityFromScore } from "./battery";

export interface RentalContext {
  status: "ACTIVE" | "ENDING_SOON" | "EXPIRED" | "OVERDUE" | "RETURNED" | "CANCELLED" | "NONE";
  expectedZone: { lat: number; lng: number }; // home/return area
  geofenceRadiusKm: number;
}

/**
 * Theft / unauthorized-movement anomaly.
 *
 * Production intent: a trajectory transformer that learns normal movement and
 * scores deviation. Here: an interpretable behavioural model combining rental
 * violation, distance beyond the expected zone, outbound motion, and trajectory
 * irregularity. Never asserts "stolen" — only a risk with confidence.
 */
export function theftRisk(window: TelemetryPoint[], ctx: RentalContext): AiResult {
  const pts = window.filter((w) => isNum(w.lat) && isNum(w.lng));
  if (pts.length < 2) {
    return low("Not enough location data to assess movement.");
  }

  const last = pts[pts.length - 1] as Required<TelemetryPoint>;
  const distFromZone = haversineKm(
    { lat: last.lat!, lng: last.lng! },
    ctx.expectedZone
  );
  const beyondFence = clamp01(
    (distFromZone - ctx.geofenceRadiusKm) / ctx.geofenceRadiusKm
  );

  // Outbound motion: is the vehicle moving *away* from the expected zone?
  const prev = pts[pts.length - 2] as Required<TelemetryPoint>;
  const prevDist = haversineKm({ lat: prev.lat!, lng: prev.lng! }, ctx.expectedZone);
  const outbound = clamp01((distFromZone - prevDist) / 0.5); // >0.5km/step away

  // Rental-state violation.
  const rentalViolation =
    ctx.status === "OVERDUE" || ctx.status === "EXPIRED"
      ? 1
      : ctx.status === "ENDING_SOON"
      ? 0.3
      : 0;

  // Trajectory irregularity: erratic bearing changes.
  const bearings: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    bearings.push(
      bearing(
        { lat: pts[i - 1].lat!, lng: pts[i - 1].lng! },
        { lat: pts[i].lat!, lng: pts[i].lng! }
      )
    );
  }
  const irregularity = clamp01(std(bearings) / 90);

  const speeds = window.map((w) => w.speed).filter(isNum);
  const moving = mean(speeds) > 5 ? 1 : 0;

  const score = Math.round(
    clamp01(
      0.35 * rentalViolation +
        0.25 * beyondFence +
        0.2 * outbound * moving +
        0.1 * irregularity +
        0.1 * moving
    ) * 100
  );

  const explanation: string[] = [];
  if (rentalViolation >= 1) explanation.push("Rental has expired but the vehicle is still in use.");
  if (beyondFence > 0) explanation.push(`Vehicle is ${distFromZone.toFixed(1)} km outside the expected zone.`);
  if (outbound > 0.3 && moving) explanation.push("Vehicle is moving away from the expected area.");
  if (irregularity > 0.5) explanation.push("Trajectory is unusually erratic.");
  if (explanation.length === 0) explanation.push("Movement pattern looks normal.");

  const confidence = clamp01(0.4 + Math.min(pts.length, 20) / 40);

  return {
    score,
    severity: severityFromScore(score),
    confidence: Math.round(confidence * 100) / 100,
    label:
      score >= 75
        ? "Possible unauthorized movement"
        : score >= 45
        ? "Movement to verify"
        : "Normal movement",
    explanation,
    recommended_action:
      score >= 75
        ? "Contact the client, verify the rental, and locate the vehicle. Escalate if unresolved."
        : score >= 45
        ? "Contact the client to confirm the trip is expected."
        : "No action needed.",
    technical: {
      distFromZoneKm: round2(distFromZone),
      beyondFence: round2(beyondFence),
      outbound: round2(outbound),
      rentalViolation,
      irregularity: round2(irregularity),
    },
  };
}

function low(msg: string): AiResult {
  return {
    score: 0,
    severity: "LOW",
    confidence: 0.3,
    label: "Normal movement",
    explanation: [msg],
    recommended_action: "No action needed.",
  };
}
function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
