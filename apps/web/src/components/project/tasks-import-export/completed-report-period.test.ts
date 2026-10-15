import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { completedReportPeriod } from "./completed-report-period";

afterEach(() => vi.unstubAllEnvs());

describe("completion report calendar dates", () => {
  it("includes both dates and converts local calendar midnights to UTC", () => {
    vi.stubEnv("TZ", "Australia/Brisbane");
    expect(completedReportPeriod("2026-10-01", "2026-10-14")).toEqual({
      from: "2026-09-30T14:00:00.000Z",
      to: "2026-10-14T14:00:00.000Z",
      timeZone: "Australia/Brisbane",
    });
  });
  it("handles a daylight-saving day as 23 hours rather than adding 24 hours", () => {
    vi.stubEnv("TZ", "Australia/Sydney");
    const period = completedReportPeriod("2026-10-04", "2026-10-04")!;
    expect(Date.parse(period.to) - Date.parse(period.from)).toBe(
      23 * 3_600_000,
    );
  });
  it("rejects backwards or invalid dates", () => {
    expect(completedReportPeriod("2026-10-15", "2026-10-14")).toBeNull();
    expect(completedReportPeriod("2026-02-30", "2026-03-01")).toBeNull();
    expect(completedReportPeriod("", "2026-10-14")).toBeNull();
  });
});
