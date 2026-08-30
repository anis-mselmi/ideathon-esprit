// Centralized, configurable business rules. Overridable via env.
function num(key: string, fallback: number): number {
  const v = process.env[key];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const rules = {
  rentalEndingWarningMinutes: num("RENTAL_ENDING_WARNING_MINUTES", 15),
  overdueGraceMinutes: num("OVERDUE_GRACE_MINUTES", 10),
  battery: {
    criticalTemperature: num("BATTERY_CRITICAL_TEMPERATURE", 55),
    warnTemperature: num("BATTERY_WARN_TEMPERATURE", 48),
    lowVoltage: num("BATTERY_LOW_VOLTAGE", 34),
    lowSoc: num("BATTERY_LOW_SOC", 15),
  },
  theft: {
    geofenceRadiusKm: num("THEFT_GEOFENCE_RADIUS_KM", 8),
  },
  // Booking rules
  booking: {
    minLeadMinutes: num("BOOKING_MIN_LEAD_MINUTES", 30), // can't book within 30 min
    cancelCutoffMinutes: num("BOOKING_CANCEL_CUTOFF_MINUTES", 60),
    modifyCutoffMinutes: num("BOOKING_MODIFY_CUTOFF_MINUTES", 60),
    maxHours: 24,
  },
} as const;

export const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "";
export const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
