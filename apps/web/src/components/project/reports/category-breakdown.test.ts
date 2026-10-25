import { describe, expect, it } from "vite-plus/test";
import { categoryBreakdown, categoryPercent } from "./category-breakdown";

describe("category time visualization", () => {
  const options = ["Marketing", "Sales", "Admin"];
  it("ranks time while preserving colors, exact totals and zero-time categories", () => {
    const report = categoryBreakdown(options, [
      { category: "Sales", taskCount: 2, totalSeconds: 7200 },
      { category: "Marketing", taskCount: 1, totalSeconds: 3600 },
      { category: null, taskCount: 1, totalSeconds: 900 },
    ]);
    expect(report.totalSeconds).toBe(11700);
    expect(report.rows.map((row) => row.category)).toEqual([
      "Sales",
      "Marketing",
      null,
      "Admin",
    ]);
    expect(report.rows.reduce((sum, row) => sum + row.percent, 0)).toBeCloseTo(
      100,
    );
    expect(report.rows[3]).toMatchObject({
      taskCount: 0,
      totalSeconds: 0,
      percent: 0,
    });
    const changed = categoryBreakdown(options, [
      { category: "Marketing", taskCount: 1, totalSeconds: 50000 },
    ]);
    expect(changed.rows[0].color).toBe(report.rows[1].color);
  });
  it("handles no work and tiny shares without fake bar lengths or NaN", () => {
    const empty = categoryBreakdown(options, []);
    expect(empty.totalSeconds).toBe(0);
    expect(
      empty.rows.every((row) => row.percent === 0 && row.offset === 0),
    ).toBe(true);
    expect(categoryPercent(0, "en-US")).toBe("0%");
    expect(categoryPercent(0.01, "en-US")).toBe("<0.1%");
  });
});
