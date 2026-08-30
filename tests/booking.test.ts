import { describe, it, expect } from "vitest";
import { priceFor, canModify, canCancel, validateWindow } from "@/lib/booking";

const inMinutes = (m: number) => new Date(Date.now() + m * 60000);

describe("booking business rules", () => {
  it("prices duration correctly", () => {
    expect(priceFor(10, 4)).toBe(40);
    expect(priceFor(8.5, 3)).toBe(25.5);
  });

  it("cannot modify a booking that already started", () => {
    expect(canModify(inMinutes(-5)).ok).toBe(false);
  });

  it("cannot modify too close to start", () => {
    expect(canModify(inMinutes(10)).ok).toBe(false);
  });

  it("can modify a booking far ahead", () => {
    expect(canModify(inMinutes(600)).ok).toBe(true);
  });

  it("cannot cancel close to start but can far ahead", () => {
    expect(canCancel(inMinutes(10)).ok).toBe(false);
    expect(canCancel(inMinutes(600)).ok).toBe(true);
  });

  it("validates the requested window", () => {
    expect(validateWindow(inMinutes(120), 3).ok).toBe(true);
    expect(validateWindow(inMinutes(5), 3).ok).toBe(false); // too soon
    expect(validateWindow(inMinutes(120), 0).ok).toBe(false); // bad duration
    expect(validateWindow(inMinutes(120), 48).ok).toBe(false); // too long
  });
});
