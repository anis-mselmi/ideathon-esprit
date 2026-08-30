// In-process realtime event bus. Backs Server-Sent Events to the dashboards.
// Survives across Next.js module reloads via a global.
import { EventEmitter } from "events";

export type AppEvent =
  | { type: "telemetry"; vehicleCode: string; data: unknown }
  | { type: "incident"; severity: string; data: unknown }
  | { type: "notification"; userId: string; data: unknown }
  | { type: "vehicle-status"; vehicleCode: string; status: string }
  | { type: "risk"; vehicleCode: string; data: unknown };

const g = globalThis as unknown as { __evaBus?: EventEmitter };
export const bus = g.__evaBus ?? new EventEmitter();
bus.setMaxListeners(200);
g.__evaBus = bus;

export function emit(e: AppEvent) {
  bus.emit("event", e);
}

export function subscribe(fn: (e: AppEvent) => void) {
  bus.on("event", fn);
  return () => bus.off("event", fn);
}
