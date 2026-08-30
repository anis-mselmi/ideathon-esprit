import { describe, it, expect } from "vitest";
import { batteryAnomaly, batterySoh } from "@/lib/ai/battery";
import { theftRisk } from "@/lib/ai/theft";
import { tamperingRisk } from "@/lib/ai/tampering";
import { fuzzyDecision } from "@/lib/ai/fuzzy";
import { localAnalyze } from "@/lib/ai";
import { TelemetryPoint } from "@/lib/ai/types";

function series(n: number, gen: (i: number) => Partial<TelemetryPoint>): TelemetryPoint[] {
  const base = Date.now() - n * 3000;
  return Array.from({ length: n }, (_, i) => ({
    timestamp: base + i * 3000,
    temperature: 30, voltage: 40, soc: 60, speed: 0,
    lat: 36.8, lng: 10.18, gpsAvailable: true, bleAvailable: true,
    ...gen(i),
  }));
}

describe("battery anomaly detector", () => {
  it("stays low for healthy telemetry", () => {
    const w = series(30, () => ({}));
    expect(batteryAnomaly(w).score).toBeLessThan(35);
  });

  it("flags sustained overheating as high risk", () => {
    const w = series(30, (i) => ({ temperature: 30 + i * 1.2, voltage: 40 - i * 0.1 }));
    const r = batteryAnomaly(w);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.severity === "HIGH" || r.severity === "CRITICAL").toBe(true);
  });
});

describe("battery SOH", () => {
  it("healthy new battery scores high", () => {
    const r = batterySoh({ cycleCount: 30, ageMonths: 2, avgTemp: 30, voltInstability: 0.2, anomalyCount: 0 });
    expect(r.score).toBeGreaterThan(85);
  });
  it("worn battery scores low and asks for service", () => {
    const r = batterySoh({ cycleCount: 750, ageMonths: 30, avgTemp: 48, voltInstability: 1.5, anomalyCount: 6 });
    expect(r.score).toBeLessThan(50);
  });
});

describe("theft behavioural detector", () => {
  const zone = { lat: 36.8, lng: 10.18 };
  it("normal active rental near zone = low", () => {
    const w = series(20, () => ({ speed: 15 }));
    const r = theftRisk(w, { status: "ACTIVE", expectedZone: zone, geofenceRadiusKm: 8 });
    expect(r.score).toBeLessThan(45);
  });
  it("expired rental moving far away = high", () => {
    const w = series(20, (i) => ({ speed: 30, lat: 36.8 + i * 0.02, lng: 10.18 + i * 0.02 }));
    const r = theftRisk(w, { status: "OVERDUE", expectedZone: zone, geofenceRadiusKm: 8 });
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.label).toMatch(/unauthorized|verify/i);
  });
});

describe("tampering detector", () => {
  it("detects signal loss while moving", () => {
    const w = series(20, (i) => ({ speed: 25, gpsAvailable: i < 15, bleAvailable: i < 15 }));
    const r = tamperingRisk(w);
    expect(r.score).toBeGreaterThanOrEqual(45);
  });
});

describe("fuzzy decision layer", () => {
  it("battery-critical alone yields at least HIGH", () => {
    const d = fuzzyDecision({ batteryAnomaly: 85, theftAnomaly: 10, tamperAnomaly: 5, rentalViolation: 0, confidence: 0.9 });
    expect(d.overall).toBeGreaterThanOrEqual(58);
    expect(d.driver).toBe("BATTERY");
  });
  it("everything calm yields LOW", () => {
    const d = fuzzyDecision({ batteryAnomaly: 10, theftAnomaly: 8, tamperAnomaly: 5, rentalViolation: 0, confidence: 0.9 });
    expect(d.severity).toBe("LOW");
  });
  it("expired rental + movement escalates theft", () => {
    const d = fuzzyDecision({ batteryAnomaly: 10, theftAnomaly: 80, tamperAnomaly: 20, rentalViolation: 100, confidence: 0.85 });
    expect(d.overall).toBeGreaterThanOrEqual(70);
  });
});

describe("full analyze pipeline", () => {
  it("separates detection from decision", () => {
    const w = series(30, (i) => ({ temperature: 30 + i * 1.2 }));
    const out = localAnalyze(w, { status: "ACTIVE", expectedZone: { lat: 36.8, lng: 10.18 }, geofenceRadiusKm: 8 });
    expect(out.detection.battery.score).toBeGreaterThan(0);
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(out.decision.severity);
  });
});
