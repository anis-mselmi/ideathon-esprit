"use client";

import { useEffect, useRef } from "react";

export type StreamEvent =
  | { type: "telemetry"; vehicleCode: string; data: any }
  | { type: "incident"; severity: string; data: any }
  | { type: "notification"; userId: string; data: any }
  | { type: "vehicle-status"; vehicleCode: string; status: string }
  | { type: "risk"; vehicleCode: string; data: any };

/**
 * Subscribe to the server's SSE stream. Reconnects automatically. The handler
 * ref is kept fresh so callers don't need to memoize.
 */
export function useRealtime(onEvent: (e: StreamEvent) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (msg) => {
      try {
        handler.current(JSON.parse(msg.data));
      } catch {
        /* ignore keep-alives */
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do.
    };
    return () => es.close();
  }, []);
}
