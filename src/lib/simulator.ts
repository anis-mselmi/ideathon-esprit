import { EspTelemetry } from "./telemetry";

/**
 * ESP32 fleet simulator.
 *
 * Produces telemetry frames in the real ESP32 contract. Each vehicle keeps a
 * small physical state that evolves per tick; a scenario steers that evolution.
 * Includes BLE RSSI noise + RF outliers, GPS/BLE loss, and offline buffering.
 */

export type Scenario =
  | "NORMAL"
  | "LOW_BATTERY"
  | "OVERHEATING"
  | "VOLTAGE_ANOMALY"
  | "BATTERY_DEGRADATION"
  | "GPS_LOSS"
  | "BLE_LOSS"
  | "TAMPERING"
  | "SUSPICIOUS_MOVEMENT"
  | "THEFT_RISK";

export interface SimVehicleState {
  vehicleCode: string;
  batteryCode: string;
  lat: number;
  lng: number;
  homeLat: number;
  homeLng: number;
  temperature: number;
  voltage: number;
  soc: number;
  speed: number;
  scenario: Scenario;
  ticksInScenario: number;
  gpsAvailable: boolean;
  bleAvailable: boolean;
  buffer: EspTelemetry[]; // store-and-forward when "offline"
  offline: boolean;
}

export function initVehicle(
  vehicleCode: string,
  batteryCode: string,
  lat: number,
  lng: number
): SimVehicleState {
  return {
    vehicleCode,
    batteryCode,
    lat,
    lng,
    homeLat: lat,
    homeLng: lng,
    temperature: 30 + rand(-2, 4),
    voltage: 40 + rand(-0.5, 1),
    soc: 60 + rand(-20, 35),
    speed: 0,
    scenario: "NORMAL",
    ticksInScenario: 0,
    gpsAvailable: true,
    bleAvailable: true,
    buffer: [],
    offline: false,
  };
}

export function setScenario(s: SimVehicleState, scenario: Scenario) {
  s.scenario = scenario;
  s.ticksInScenario = 0;
  s.gpsAvailable = true;
  s.bleAvailable = true;
}

/** Advance one tick and return the telemetry frame (undefined if buffered offline). */
export function tick(s: SimVehicleState): EspTelemetry | undefined {
  s.ticksInScenario++;
  const k = s.ticksInScenario;

  // Baseline drift toward nominal.
  s.temperature += (30 - s.temperature) * 0.05 + rand(-0.4, 0.4);
  s.voltage += (40 - s.voltage) * 0.05 + rand(-0.1, 0.1);
  s.gpsAvailable = true;
  s.bleAvailable = true;
  s.speed = Math.max(0, s.speed + rand(-3, 3));

  switch (s.scenario) {
    case "OVERHEATING":
      // Gentle ramp that levels off in a realistic danger band (~50-62°C).
      s.temperature += Math.max(0, (60 - s.temperature) * 0.25) + 0.8;
      s.voltage -= 0.3;
      s.speed = 22 + rand(-4, 6);
      break;
    case "VOLTAGE_ANOMALY":
      s.voltage -= 0.7 + Math.sin(k) * 0.5; // unstable drop
      break;
    case "LOW_BATTERY":
      s.soc = Math.max(2, s.soc - 3);
      s.voltage -= 0.2;
      break;
    case "BATTERY_DEGRADATION":
      s.temperature += 0.8;
      s.voltage -= 0.15;
      s.soc = Math.max(5, s.soc - 1.5);
      break;
    case "GPS_LOSS":
      s.gpsAvailable = k > 1;
      s.speed = 18 + rand(-3, 3);
      break;
    case "BLE_LOSS":
      s.bleAvailable = k > 1;
      break;
    case "SUSPICIOUS_MOVEMENT":
    case "THEFT_RISK": {
      // Move outbound, away from home, erratically.
      s.speed = 28 + rand(-5, 8);
      const outbound = 0.004 * k;
      s.lat += outbound + rand(-0.001, 0.001);
      s.lng += outbound * 0.8 + rand(-0.0015, 0.0015);
      if (s.scenario === "THEFT_RISK" && k > 4) {
        // signals cut out mid-flight -> also drives tampering
        s.gpsAvailable = false;
        s.bleAvailable = false;
      }
      break;
    }
    case "TAMPERING":
      s.speed = 20 + rand(-3, 5);
      s.lat += 0.002;
      s.lng += 0.0015;
      if (k > 1) {
        s.gpsAvailable = false;
        s.bleAvailable = false;
      }
      break;
    case "NORMAL":
    default:
      // Gentle wander within neighborhood.
      s.lat += rand(-0.0008, 0.0008);
      s.lng += rand(-0.0008, 0.0008);
      s.speed = Math.random() < 0.5 ? 0 : 15 + rand(-5, 8);
      s.soc = Math.max(3, s.soc - 0.15);
      break;
  }

  s.temperature = clamp(s.temperature, 18, 90);
  s.voltage = clamp(s.voltage, 28, 46);
  s.soc = clamp(s.soc, 0, 100);

  const frame: EspTelemetry = {
    vehicleCode: s.vehicleCode,
    batteryCode: s.batteryCode,
    timestamp: new Date().toISOString(),
    latitude: s.gpsAvailable ? round5(s.lat) : undefined,
    longitude: s.gpsAvailable ? round5(s.lng) : undefined,
    temperature: round2(s.temperature),
    voltage: round2(s.voltage),
    soc: Math.round(s.soc),
    speed: Math.round(s.speed),
    bleReadings: s.bleAvailable ? bleSamples() : [],
    gpsAvailable: s.gpsAvailable,
    bleAvailable: s.bleAvailable,
    scenario: s.scenario,
  };

  // Offline store-and-forward: occasionally the edge device loses connectivity.
  if (s.offline) {
    s.buffer.push(frame);
    return undefined;
  }
  // Flush any buffered frames first (handled by caller via drainBuffer).
  return frame;
}

export function drainBuffer(s: SimVehicleState): EspTelemetry[] {
  const out = s.buffer;
  s.buffer = [];
  return out;
}

/** BLE RSSI samples around a stable value, with an occasional RF outlier. */
function bleSamples(): number[] {
  const base = -49 + rand(-2, 2);
  const n = 5;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.round(base + rand(-2, 2)));
  if (Math.random() < 0.25) out[Math.floor(Math.random() * n)] = Math.round(base - 30); // metal/multipath outlier
  return out;
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}
function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
function round2(x: number) {
  return Math.round(x * 100) / 100;
}
function round5(x: number) {
  return Math.round(x * 1e5) / 1e5;
}
