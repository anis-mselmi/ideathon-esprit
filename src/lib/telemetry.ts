import { prisma } from "./db";
import { emit } from "./events";
import { evaluateVehicle } from "./engine";
import { robustEstimate, confidenceBand } from "./ai/stats";

/**
 * Stable telemetry contract — exactly what a real ESP32 would POST.
 * Replacing the simulator with real hardware requires no backend change.
 */
export interface EspTelemetry {
  vehicleCode: string; // "EV-014"
  batteryCode?: string;
  timestamp?: string; // ISO; defaults to now
  latitude?: number;
  longitude?: number;
  temperature?: number;
  voltage?: number;
  soc?: number;
  speed?: number;
  bleReadings?: number[]; // raw RSSI samples; robust-filtered server-side
  gpsAvailable?: boolean;
  bleAvailable?: boolean;
  scenario?: string;
}

/**
 * Ingest one telemetry frame: robust-filter BLE, persist telemetry + location +
 * battery reading, then trigger AI evaluation. Returns the persisted row.
 */
export async function ingestTelemetry(t: EspTelemetry) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { code: t.vehicleCode },
    include: { battery: true },
  });
  if (!vehicle) throw new Error(`Unknown vehicle ${t.vehicleCode}`);

  // Robust BLE estimate from multiple raw readings (RF mitigation).
  let bleSignal: number | null = null;
  let bleConfidence: "HIGH" | "MEDIUM" | "LOW" | null = null;
  if (t.bleReadings && t.bleReadings.length) {
    const { estimate, stability } = robustEstimate(t.bleReadings);
    bleSignal = Math.round(estimate);
    bleConfidence = confidenceBand(stability);
  }

  const ts = t.timestamp ? new Date(t.timestamp) : new Date();

  const row = await prisma.telemetry.create({
    data: {
      vehicleId: vehicle.id,
      batteryCode: t.batteryCode ?? vehicle.battery?.code,
      timestamp: ts,
      latitude: t.latitude ?? null,
      longitude: t.longitude ?? null,
      temperature: t.temperature ?? null,
      voltage: t.voltage ?? null,
      soc: t.soc ?? null,
      speed: t.speed ?? null,
      bleSignal,
      bleConfidence: bleConfidence ?? undefined,
      gpsAvailable: t.gpsAvailable ?? true,
      bleAvailable: t.bleAvailable ?? true,
      scenario: t.scenario ?? "NORMAL",
    },
  });

  // Location (only when GPS available).
  if (t.gpsAvailable !== false && t.latitude != null && t.longitude != null) {
    await prisma.vehicleLocation.create({
      data: {
        vehicleId: vehicle.id,
        lat: t.latitude,
        lng: t.longitude,
        gpsConfidence: 0.9,
        timestamp: ts,
      },
    });
  }

  // Battery reading + live battery state.
  if (vehicle.battery && (t.temperature != null || t.voltage != null || t.soc != null)) {
    await prisma.batteryReading.create({
      data: {
        batteryId: vehicle.battery.id,
        temperature: t.temperature ?? 30,
        voltage: t.voltage ?? 40,
        soc: t.soc ?? vehicle.battery.soc,
        charging: false,
      },
    });
    if (t.soc != null) {
      await prisma.battery.update({
        where: { id: vehicle.battery.id },
        data: { soc: t.soc },
      });
    }
  }

  emit({
    type: "telemetry",
    vehicleCode: vehicle.code,
    data: {
      vehicleCode: vehicle.code,
      lat: t.latitude,
      lng: t.longitude,
      temperature: t.temperature,
      voltage: t.voltage,
      soc: t.soc,
      speed: t.speed,
      bleSignal,
      bleConfidence,
      gpsAvailable: t.gpsAvailable ?? true,
      bleAvailable: t.bleAvailable ?? true,
      timestamp: ts.toISOString(),
    },
  });

  // Trigger AI evaluation (fire-and-forget style, but awaited for consistency).
  await evaluateVehicle(vehicle.id);

  return row;
}
