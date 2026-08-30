import { AiResult, TelemetryPoint } from "./types";
import { clamp01, mean } from "./stats";
import { severityFromScore } from "./battery";

/**
 * Tampering anomaly — detects attempts to disable/manipulate tracking.
 *
 * Production intent: a multivariate GRU/LSTM autoencoder over sensor-consistency
 * signals. Here: an interpretable consistency model. The key insight is
 * *contradiction*: a vehicle that is clearly moving should keep producing GPS +
 * BLE + telemetry. Sudden simultaneous signal loss while in motion is the
 * strongest tampering indicator.
 */
export function tamperingRisk(window: TelemetryPoint[]): AiResult {
  if (window.length < 3) {
    return {
      score: 0,
      severity: "LOW",
      confidence: 0.3,
      explanation: ["Not enough data to assess tampering."],
      recommended_action: "No action needed.",
    };
  }

  const recent = window.slice(-5);
  const speeds = window.map((w) => w.speed).filter(isNum);
  const wasMoving = mean(speeds.slice(-8)) > 5;

  const gpsLostNow = recent.some((r) => r.gpsAvailable === false);
  const bleLostNow = recent.some((r) => r.bleAvailable === false);

  // Was signal healthy just before the loss?
  const earlier = window.slice(0, Math.max(1, window.length - 5));
  const gpsWasHealthy = earlier.some((r) => r.gpsAvailable !== false);
  const bleWasHealthy = earlier.some((r) => r.bleAvailable !== false);

  const gpsDrop = gpsLostNow && gpsWasHealthy ? 1 : 0;
  const bleDrop = bleLostNow && bleWasHealthy ? 1 : 0;

  // Telemetry gap: last point much older than the cadence would suggest.
  const gaps: number[] = [];
  for (let i = 1; i < window.length; i++) {
    gaps.push(window[i].timestamp - window[i - 1].timestamp);
  }
  const medianGap = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0;
  const lastGap = gaps.length ? gaps[gaps.length - 1] : 0;
  const telemetryGap = medianGap > 0 && lastGap > medianGap * 3 ? 1 : 0;

  // The contradiction term: moving but signals dropping.
  const contradiction = wasMoving ? (gpsDrop + bleDrop) / 2 : (gpsDrop + bleDrop) / 4;

  const score = Math.round(
    clamp01(
      0.4 * contradiction +
        0.2 * gpsDrop +
        0.2 * bleDrop +
        0.2 * telemetryGap
    ) * 100
  );

  const explanation: string[] = [];
  if (gpsDrop) explanation.push("GPS signal was lost while the device was active.");
  if (bleDrop) explanation.push("BLE identity signal disappeared.");
  if (wasMoving && (gpsDrop || bleDrop))
    explanation.push("Signals dropped while the vehicle was moving — a suspicious combination.");
  if (telemetryGap) explanation.push("Telemetry stopped arriving on schedule.");
  if (explanation.length === 0) explanation.push("Sensor signals are consistent.");

  const confidence = clamp01(0.45 + (gpsDrop + bleDrop) * 0.2);

  return {
    score,
    severity: severityFromScore(score),
    confidence: Math.round(confidence * 100) / 100,
    label: score >= 75 ? "Possible device tampering" : score >= 45 ? "Signal irregularity" : "Normal",
    explanation,
    recommended_action:
      score >= 75
        ? "Possible tracking interruption — locate the vehicle by last known position and contact the client."
        : score >= 45
        ? "Watch for repeated signal loss; may be interference."
        : "No action needed.",
    technical: { gpsDrop, bleDrop, telemetryGap, wasMoving, contradiction: round2(contradiction) },
  };
}

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
