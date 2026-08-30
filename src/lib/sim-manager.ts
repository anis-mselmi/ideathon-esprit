import { prisma } from "./db";
import { ingestTelemetry } from "./telemetry";
import { sweepRentals } from "./rental-monitor";
import {
  SimVehicleState,
  Scenario,
  initVehicle,
  setScenario,
  tick,
  drainBuffer,
} from "./simulator";

/**
 * Singleton simulator manager. Holds live per-vehicle state and a ticking loop.
 * Persisted on globalThis so Next.js HMR doesn't spawn duplicates.
 */
interface SimState {
  vehicles: Map<string, SimVehicleState>;
  timer: NodeJS.Timeout | null;
  running: boolean;
  intervalMs: number;
  loaded: boolean;
}

const g = globalThis as unknown as { __evaSim?: SimState };
const sim: SimState =
  g.__evaSim ??
  { vehicles: new Map(), timer: null, running: false, intervalMs: 3000, loaded: false };
g.__evaSim = sim;

/** Load vehicle seeds from the DB into the simulator (idempotent). */
export async function loadFleet() {
  const vehicles = await prisma.vehicle.findMany({ include: { battery: true } });
  for (const v of vehicles) {
    if (!sim.vehicles.has(v.code)) {
      sim.vehicles.set(
        v.code,
        initVehicle(v.code, v.battery?.code ?? "BAT-000", v.homeLat, v.homeLng)
      );
    }
  }
  sim.loaded = true;
  return sim.vehicles.size;
}

async function doTick() {
  const jobs: Promise<unknown>[] = [];
  for (const s of sim.vehicles.values()) {
    // Flush buffered (offline) frames first.
    for (const buffered of drainBuffer(s)) {
      jobs.push(ingestTelemetry(buffered).catch(() => {}));
    }
    const frame = tick(s);
    if (frame) jobs.push(ingestTelemetry(frame).catch(() => {}));
    // Auto-relax transient scenarios after a while.
    if (
      ["GPS_LOSS", "BLE_LOSS"].includes(s.scenario) &&
      s.ticksInScenario > 6
    ) {
      setScenario(s, "NORMAL");
    }
  }
  await Promise.allSettled(jobs);
  // Advance rental lifecycle (expiry → overdue) on every tick.
  await sweepRentals().catch(() => {});
}

export async function startSim(intervalMs?: number) {
  if (!sim.loaded) await loadFleet();
  if (intervalMs) sim.intervalMs = intervalMs;
  if (sim.timer) return status();
  sim.running = true;
  sim.timer = setInterval(() => {
    doTick().catch(() => {});
  }, sim.intervalMs);
  return status();
}

export function stopSim() {
  if (sim.timer) clearInterval(sim.timer);
  sim.timer = null;
  sim.running = false;
  return status();
}

/** Trigger a scenario on one vehicle (or all when code omitted). */
export async function trigger(scenario: Scenario, vehicleCode?: string) {
  if (!sim.loaded) await loadFleet();
  if (vehicleCode) {
    const s = sim.vehicles.get(vehicleCode);
    if (s) setScenario(s, scenario);
  } else {
    for (const s of sim.vehicles.values()) setScenario(s, scenario);
  }
  return status();
}

export function setOffline(vehicleCode: string, offline: boolean) {
  const s = sim.vehicles.get(vehicleCode);
  if (s) s.offline = offline;
  return status();
}

/** Run a single tick immediately (useful for tests / manual stepping). */
export async function stepOnce() {
  if (!sim.loaded) await loadFleet();
  await doTick();
  return status();
}

export function status() {
  return {
    running: sim.running,
    intervalMs: sim.intervalMs,
    vehicles: [...sim.vehicles.values()].map((s) => ({
      vehicleCode: s.vehicleCode,
      scenario: s.scenario,
      offline: s.offline,
      soc: Math.round(s.soc),
      temperature: Math.round(s.temperature),
    })),
  };
}
