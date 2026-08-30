// Structured AI outputs — stable contract shared with a future Python service.

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AiResult {
  score: number; // 0..100
  severity: Severity;
  confidence: number; // 0..1
  label?: string;
  explanation: string[]; // human-readable contributing factors
  recommended_action: string;
  technical?: Record<string, unknown>; // raw values for "Why?"
}

export interface TelemetryPoint {
  timestamp: number;
  temperature?: number | null;
  voltage?: number | null;
  soc?: number | null;
  speed?: number | null;
  lat?: number | null;
  lng?: number | null;
  bleSignal?: number | null;
  gpsAvailable?: boolean;
  bleAvailable?: boolean;
}
