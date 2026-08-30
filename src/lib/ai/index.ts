import { AI_SERVICE_URL } from "../config";
import { TelemetryPoint } from "./types";
import { batteryAnomaly, batteryFault } from "./battery";
import { theftRisk, RentalContext } from "./theft";
import { tamperingRisk } from "./tampering";
import { fuzzyDecision } from "./fuzzy";

export * from "./types";
export * from "./battery";
export * from "./theft";
export * from "./tampering";
export * from "./fuzzy";
export * from "./stats";

/**
 * Unified analysis for a vehicle window. Runs the detectors, then the fuzzy
 * decision layer, and returns AI-detection + decision separately (the spec's
 * key distinction: "what looks abnormal?" vs "what should we do?").
 *
 * If AI_SERVICE_URL is set, delegates to an external Python service with the
 * same contract; otherwise uses the built-in TypeScript detectors. On any
 * external failure it falls back locally — the dashboard never goes dark.
 */
export async function analyzeVehicle(
  window: TelemetryPoint[],
  ctx: RentalContext
) {
  if (AI_SERVICE_URL) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/predict/risk-fusion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ window, ctx }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) return { ...(await res.json()), source: "external" as const };
    } catch {
      // fall through to local
    }
  }
  return { ...localAnalyze(window, ctx), source: "local" as const };
}

export function localAnalyze(window: TelemetryPoint[], ctx: RentalContext) {
  const battery = batteryAnomaly(window);
  const fault = batteryFault(window);
  const theft = theftRisk(window, ctx);
  const tamper = tamperingRisk(window);

  const rentalViolation =
    ctx.status === "OVERDUE" || ctx.status === "EXPIRED" ? 100 : 0;

  // Dampen by the confidence of the *dominant* signal, not the average — a
  // low-confidence theft reading must not mute a high-confidence battery alert.
  const domains = [
    { score: battery.score, conf: battery.confidence },
    { score: theft.score, conf: theft.confidence },
    { score: tamper.score, conf: tamper.confidence },
    { score: rentalViolation, conf: 0.95 },
  ].sort((a, b) => b.score - a.score);
  const confidence = domains[0].conf;

  const decision = fuzzyDecision({
    batteryAnomaly: battery.score,
    theftAnomaly: theft.score,
    tamperAnomaly: tamper.score,
    rentalViolation,
    confidence,
  });

  return {
    detection: { battery, fault, theft, tamper, rentalViolation },
    decision,
  };
}
