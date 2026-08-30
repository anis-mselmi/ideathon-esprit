// Robust statistics used across the AI layer.

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** Median absolute deviation — robust spread estimate. */
export function mad(xs: number[]): number {
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

/**
 * Robust estimate from noisy readings (e.g. BLE RSSI): removes outliers via
 * modified z-score, returns the median of the clean set plus a stability score.
 */
export function robustEstimate(readings: number[]): {
  estimate: number;
  cleaned: number[];
  outliers: number[];
  stability: number; // 0..1, higher = more stable
} {
  if (readings.length === 0)
    return { estimate: NaN, cleaned: [], outliers: [], stability: 0 };
  const m = median(readings);
  const d = mad(readings) || 1e-6;
  const cleaned: number[] = [];
  const outliers: number[] = [];
  for (const r of readings) {
    // 0.6745 scales MAD to be comparable to std for normal data.
    const zmod = (0.6745 * Math.abs(r - m)) / d;
    if (zmod > 3.5) outliers.push(r);
    else cleaned.push(r);
  }
  const set = cleaned.length ? cleaned : readings;
  const spread = std(set);
  // Map spread to stability: small spread -> high stability.
  const stability = clamp01(1 - spread / 15);
  return { estimate: median(set), cleaned, outliers, stability };
}

export function confidenceBand(stability: number): "HIGH" | "MEDIUM" | "LOW" {
  if (stability >= 0.75) return "HIGH";
  if (stability >= 0.45) return "MEDIUM";
  return "LOW";
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Exponentially weighted moving average. */
export function ewma(xs: number[], alpha = 0.4): number {
  if (xs.length === 0) return NaN;
  let acc = xs[0];
  for (let i = 1; i < xs.length; i++) acc = alpha * xs[i] + (1 - alpha) * acc;
  return acc;
}

/** Slope of a simple least-squares line through the series (per step). */
export function slope(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2;
  const ym = mean(xs);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xm) * (xs[i] - ym);
    den += (i - xm) ** 2;
  }
  return den === 0 ? 0 : num / den;
}
