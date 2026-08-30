import { AiResult, TelemetryPoint, Severity } from "./types";
import { clamp, clamp01, ewma, mean, slope, std } from "./stats";
import { rules } from "../config";

/**
 * Battery anomaly detector.
 *
 * Production intent: a GRU/LSTM autoencoder trained on healthy sequences; the
 * reconstruction error of a fresh window is the anomaly score.
 *
 * This implementation approximates that with an interpretable "reconstruction
 * error": we build an expected profile (smoothed baseline of the window) and a
 * physical expectation (temperature roughly stable, voltage roughly stable for
 * a healthy pack), then measure how far the recent points deviate. Same 0..100
 * contract as the neural model, so it can be swapped behind AI_SERVICE_URL.
 */
export function batteryAnomaly(window: TelemetryPoint[]): AiResult {
  const temps = window.map((w) => w.temperature).filter(isNum);
  const volts = window.map((w) => w.voltage).filter(isNum);

  if (temps.length < 3 || volts.length < 3) {
    return {
      score: 0,
      severity: "LOW",
      confidence: 0.2,
      explanation: ["Not enough telemetry to assess the battery yet."],
      recommended_action: "Keep monitoring.",
    };
  }

  // "Reconstruction error": deviation of recent points from smoothed baseline.
  const tempBaseline = ewma(temps, 0.3);
  const voltBaseline = ewma(volts, 0.3);
  const recentTemp = mean(temps.slice(-3));
  const recentVolt = mean(volts.slice(-3));

  const tempRise = slope(temps); // °C per step
  const voltDrop = -slope(volts); // V per step (positive = dropping)

  // Normalized error components (each ~0..1 before weighting).
  const tempErr = clamp01((recentTemp - tempBaseline) / 8 + tempRise / 3);
  const voltErr = clamp01((voltBaseline - recentVolt) / 3 + voltDrop / 1.5);
  const instability = clamp01(std(volts.slice(-6)) / 2);

  // Absolute physical severity relative to configured limits.
  const overTemp = clamp01(
    (recentTemp - rules.battery.warnTemperature) /
      (rules.battery.criticalTemperature - rules.battery.warnTemperature)
  );
  const underVolt = clamp01((rules.battery.lowVoltage + 3 - recentVolt) / 4);

  // Blend deviation ("reconstruction error") with sustained physical severity,
  // so a battery that plateaus at a dangerous temperature stays high-risk even
  // once the rate of change flattens.
  const reconstructionError =
    0.24 * tempErr + 0.2 * voltErr + 0.12 * instability + 0.3 * overTemp + 0.14 * underVolt;

  let score = Math.round(clamp01(reconstructionError * 1.15) * 100);

  // Safety floor: readings past the critical limits are always high risk.
  if (recentTemp >= rules.battery.criticalTemperature) score = Math.max(score, 78);
  else if (recentTemp >= rules.battery.warnTemperature) score = Math.max(score, 55);
  if (recentVolt <= rules.battery.lowVoltage) score = Math.max(score, 60);

  const explanation: string[] = [];
  if (tempRise > 0.6) explanation.push("Temperature is rising faster than expected.");
  if (recentTemp >= rules.battery.warnTemperature)
    explanation.push(`Temperature (${recentTemp.toFixed(1)}°C) is above the safe operating range.`);
  if (voltDrop > 0.4) explanation.push("Voltage is dropping unusually quickly.");
  if (recentVolt <= rules.battery.lowVoltage)
    explanation.push(`Voltage (${recentVolt.toFixed(1)}V) is below the healthy threshold.`);
  if (instability > 0.5) explanation.push("Voltage readings are unstable.");
  if (explanation.length === 0) explanation.push("Battery behaviour is within normal bounds.");

  // Confidence grows with window length and reading stability.
  const confidence = clamp01(0.5 + Math.min(window.length, 30) / 60 - instability * 0.2);

  return {
    score,
    severity: severityFromScore(score),
    confidence: round2(confidence),
    explanation,
    recommended_action:
      score >= 70
        ? "Ask the rider to return the vehicle and inspect the battery before redeploying."
        : score >= 40
        ? "Monitor closely; schedule an inspection if the trend continues."
        : "No action needed.",
    technical: {
      recentTemp: round2(recentTemp),
      recentVolt: round2(recentVolt),
      tempRisePerStep: round2(tempRise),
      voltDropPerStep: round2(voltDrop),
      reconstructionError: round2(reconstructionError),
      components: {
        tempErr: round2(tempErr),
        voltErr: round2(voltErr),
        instability: round2(instability),
      },
    },
  };
}

/**
 * Battery fault diagnosis — classifies the *kind* of anomaly.
 * Production intent: an LSTM / temporal-transformer classifier. Here: an
 * interpretable decision over the same engineered features. Always hedged
 * ("likely ..."), never asserted as certainty.
 */
export function batteryFault(window: TelemetryPoint[]): AiResult {
  const temps = window.map((w) => w.temperature).filter(isNum);
  const volts = window.map((w) => w.voltage).filter(isNum);
  const socs = window.map((w) => w.soc).filter(isNum);

  const recentTemp = temps.length ? mean(temps.slice(-3)) : 0;
  const voltDrop = -slope(volts);
  const socDrop = -slope(socs);
  const voltInstability = std(volts.slice(-6));

  type Cand = { label: string; weight: number };
  const cands: Cand[] = [
    { label: "Overheating", weight: clamp01((recentTemp - rules.battery.warnTemperature) / 10) },
    { label: "Abnormal voltage", weight: clamp01(voltDrop / 1.2 + voltInstability / 2) },
    { label: "Rapid discharge", weight: clamp01(socDrop / 6) },
    { label: "Sensor anomaly", weight: clamp01(voltInstability / 3 - 0.1) },
    { label: "Normal", weight: 0.25 },
  ];
  cands.sort((a, b) => b.weight - a.weight);
  const top = cands[0];
  const score = Math.round(top.weight * 100);

  return {
    score,
    severity: severityFromScore(score),
    confidence: round2(clamp01(0.45 + top.weight * 0.4)),
    label: top.label,
    explanation: [
      top.label === "Normal"
        ? "No specific fault pattern stands out."
        : `Pattern most consistent with: likely ${top.label.toLowerCase()}.`,
    ],
    recommended_action:
      top.label === "Overheating"
        ? "Inspect battery for thermal issues before further use."
        : top.label === "Abnormal voltage"
        ? "Check cell balance and connections."
        : top.label === "Rapid discharge"
        ? "Verify load and check for internal degradation."
        : "Continue monitoring.",
    technical: { candidates: cands.map((c) => ({ ...c, weight: round2(c.weight) })) },
  };
}

/**
 * State of Health estimate.
 * Production intent: XGBoost/LightGBM regression over cycle count, thermal
 * history, voltage behaviour, age, anomaly history. Here: a transparent
 * weighted feature model with the same 0..100% output.
 */
export function batterySoh(features: {
  cycleCount: number;
  ageMonths: number;
  avgTemp: number;
  voltInstability: number;
  anomalyCount: number;
}): AiResult {
  const { cycleCount, ageMonths, avgTemp, voltInstability, anomalyCount } = features;
  // Degradation contributions (each subtracts from 100%).
  const cycleWear = clamp((cycleCount / 800) * 40, 0, 40);
  const ageWear = clamp((ageMonths / 36) * 20, 0, 20);
  const thermalWear = clamp(((avgTemp - 30) / 25) * 20, 0, 20);
  const instabilityWear = clamp(voltInstability * 6, 0, 12);
  const anomalyWear = clamp(anomalyCount * 2, 0, 12);

  const soh = clamp(100 - cycleWear - ageWear - thermalWear - instabilityWear - anomalyWear, 0, 100);
  const interp =
    soh >= 80 ? "GOOD" : soh >= 60 ? "FAIR" : soh >= 40 ? "DECLINING" : "SERVICE REQUIRED";

  return {
    score: Math.round(soh),
    severity: soh >= 80 ? "LOW" : soh >= 60 ? "MEDIUM" : soh >= 40 ? "HIGH" : "CRITICAL",
    confidence: 0.75,
    label: interp,
    explanation: [
      `Estimated State of Health ${Math.round(soh)}% (${interp}).`,
      `Main factors: ${cycleCount} cycles, ${ageMonths} months age, avg ${avgTemp.toFixed(0)}°C.`,
    ],
    recommended_action:
      soh < 40
        ? "Take battery out of service and schedule replacement."
        : soh < 60
        ? "Plan for replacement soon; avoid demanding rentals."
        : "Battery healthy for normal service.",
    technical: {
      contributions: {
        cycleWear: round2(cycleWear),
        ageWear: round2(ageWear),
        thermalWear: round2(thermalWear),
        instabilityWear: round2(instabilityWear),
        anomalyWear: round2(anomalyWear),
      },
    },
  };
}

/**
 * Remaining useful life (probabilistic, hedged).
 * Production intent: temporal transformer / LSTM. Here: derived from SOH slope.
 */
export function batteryRul(soh: number, cycleCount: number): {
  cyclesLow: number;
  cyclesHigh: number;
  confidence: number;
} {
  const remainingSoh = Math.max(soh - 40, 0); // usable until ~40% SOH
  const perCycle = 0.06; // %SOH lost per cycle (rough)
  const mid = remainingSoh / perCycle;
  return {
    cyclesLow: Math.round(mid * 0.8),
    cyclesHigh: Math.round(mid * 1.2),
    confidence: 0.72,
  };
}

// ---- helpers ----
function isNum(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
export function severityFromScore(score: number): Severity {
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}
