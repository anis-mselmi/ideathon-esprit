import { describe, it, expect } from "vitest";
import { robustEstimate, confidenceBand, median, slope } from "@/lib/ai/stats";

describe("robust BLE statistics (RF mitigation)", () => {
  it("removes an RF outlier and estimates the stable RSSI", () => {
    // -85 is a metal/multipath outlier among stable -48..-51 readings.
    const { estimate, outliers } = robustEstimate([-48, -50, -49, -85, -51]);
    expect(outliers).toContain(-85);
    expect(estimate).toBeGreaterThan(-52);
    expect(estimate).toBeLessThan(-47);
  });

  it("reports HIGH confidence for stable readings and LOW for erratic", () => {
    const stable = robustEstimate([-49, -50, -49, -50, -49]);
    expect(confidenceBand(stable.stability)).toBe("HIGH");

    const erratic = robustEstimate([-40, -70, -45, -80, -55]);
    expect(confidenceBand(erratic.stability)).not.toBe("HIGH");
  });

  it("median and slope behave", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(slope([1, 2, 3, 4])).toBeCloseTo(1, 5);
    expect(slope([4, 3, 2, 1])).toBeCloseTo(-1, 5);
  });
});
