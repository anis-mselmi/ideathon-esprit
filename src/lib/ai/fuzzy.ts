import { Severity } from "./types";
import { clamp01 } from "./stats";

/**
 * Fuzzy decision layer.
 *
 * This is deliberately the FINAL interpretation layer, not the main detector.
 * The AI detectors answer "what looks abnormal?"; this engine answers "how
 * severe is it, and what should we do?" using human-readable fuzzy rules.
 *
 * Membership functions map a 0..100 score into LOW/MEDIUM/HIGH/CRITICAL degrees;
 * a small rule base fires; we defuzzify to a crisp severity.
 */

type Level = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

function memberships(score: number): Record<Level, number> {
  const s = clamp01(score / 100);
  return {
    LOW: trap(s, 0, 0, 0.15, 0.35),
    MEDIUM: tri(s, 0.25, 0.45, 0.65),
    HIGH: tri(s, 0.55, 0.7, 0.85),
    CRITICAL: trap(s, 0.75, 0.9, 1, 1),
  };
}

function tri(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0;
  return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
}
function trap(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x < b) return (x - a) / (b - a);
  if (x <= c) return 1;
  return (d - x) / (d - c);
}

export interface FuzzyInputs {
  batteryAnomaly: number;
  theftAnomaly: number;
  tamperAnomaly: number;
  rentalViolation: number; // 0 or 100
  confidence: number; // 0..1 overall detection confidence
}

export interface FuzzyDecision {
  overall: number; // 0..100
  severity: Severity;
  driver: "BATTERY" | "THEFT" | "TAMPERING" | "RENTAL" | "NONE";
}

const CRISP: Record<Level, number> = { LOW: 15, MEDIUM: 45, HIGH: 70, CRITICAL: 92 };

/** Evaluate fuzzy rules and defuzzify (weighted centroid over levels). */
export function fuzzyDecision(inp: FuzzyInputs): FuzzyDecision {
  const b = memberships(inp.batteryAnomaly);
  const t = memberships(inp.theftAnomaly);
  const m = memberships(inp.tamperAnomaly);
  const rentalHigh = inp.rentalViolation >= 100 ? 1 : 0;

  // Rule strengths per output level (max-combined).
  const level: Record<Level, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const bump = (l: Level, v: number) => (level[l] = Math.max(level[l], v));

  // Battery rules
  bump("CRITICAL", b.CRITICAL);
  bump("HIGH", b.HIGH);
  bump("MEDIUM", b.MEDIUM);
  // Theft: rental violation amplifies theft signal.
  bump("CRITICAL", Math.min(t.HIGH + rentalHigh, 1) * Math.max(t.HIGH, t.CRITICAL));
  bump("CRITICAL", t.CRITICAL);
  bump("HIGH", t.HIGH);
  bump("MEDIUM", t.MEDIUM);
  // Tampering rules
  bump("CRITICAL", m.CRITICAL);
  bump("HIGH", m.HIGH);
  bump("MEDIUM", m.MEDIUM);
  // Rental expired alone is at least HIGH (return required).
  bump("HIGH", rentalHigh * 0.8);
  // Baseline LOW only when nothing meaningful fired — otherwise it would
  // dilute a strong single-domain alert (e.g. battery-critical) toward MEDIUM.
  const maxScore = Math.max(inp.batteryAnomaly, inp.theftAnomaly, inp.tamperAnomaly, inp.rentalViolation);
  if (maxScore < 35) bump("LOW", 1);

  const num = (Object.keys(level) as Level[]).reduce((a, l) => a + level[l] * CRISP[l], 0);
  const den = (Object.keys(level) as Level[]).reduce((a, l) => a + level[l], 0) || 1;
  let overall = num / den;

  // Low detection confidence dampens the final severity (safety: don't
  // over-alert). Kept gentle so a genuine high-confidence alert isn't muted.
  overall = overall * (0.78 + 0.22 * clamp01(inp.confidence));
  overall = Math.round(overall);

  const driver = pickDriver(inp);
  return { overall, severity: sev(overall), driver };
}

function pickDriver(inp: FuzzyInputs): FuzzyDecision["driver"] {
  const entries: [FuzzyDecision["driver"], number][] = [
    ["BATTERY", inp.batteryAnomaly],
    ["THEFT", inp.theftAnomaly],
    ["TAMPERING", inp.tamperAnomaly],
    ["RENTAL", inp.rentalViolation],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][1] < 30 ? "NONE" : entries[0][0];
}

function sev(x: number): Severity {
  if (x >= 78) return "CRITICAL";
  if (x >= 58) return "HIGH";
  if (x >= 35) return "MEDIUM";
  return "LOW";
}
