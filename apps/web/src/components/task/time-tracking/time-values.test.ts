import { describe, expect, it } from "vite-plus/test";
import { formatTrackedTime, hoursToSeconds } from "./time-values";

describe("task time totals", () => {
  it("accepts hours, fractions and clearing to zero", () => {
    expect(hoursToSeconds("0")).toBe(0);
    expect(hoursToSeconds("2.5")).toBe(9000);
    expect(formatTrackedTime(9000)).toBe("2h 30m");
    expect(formatTrackedTime(0)).toBe("0h");
    expect(hoursToSeconds("0.00027778")).toBe(1);
  });
  it("rejects empty, negative, invalid and overflowing totals", () => {
    for (const value of ["", " ", "-0.001", "Infinity", "no", "596524"])
      expect(hoursToSeconds(value)).toBeNull();
  });
});
