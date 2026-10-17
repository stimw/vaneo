import { describe, expect, it } from "vite-plus/test";
import { reportCsv } from "./report-csv";
import { reportActivity, type ReportTask } from "./report-values";

function task(
  id: string,
  day: number,
  seconds: number,
  title = "Customer change",
): ReportTask {
  return {
    id,
    ticketId: `APP-${id}`,
    title,
    status: "done",
    assigneeId: "alex",
    assigneeName: "Alex Morgan",
    completedAt: new Date(2026, 9, day, 9).toISOString(),
    totalSeconds: seconds,
  };
}

describe("customer completion reports", () => {
  it("groups the corrected total by local completion date, including 0h tasks and empty dates", () => {
    const rows = [
      { date: "2026-10-02", taskCount: 2, totalSeconds: 16200 },
      { date: "2026-10-03", taskCount: 1, totalSeconds: 0 },
    ];
    expect(reportActivity(rows, "2026-10-01", "2026-10-04")).toEqual([
      { date: "2026-10-01", hours: 0, tasks: 0 },
      { date: "2026-10-02", hours: 4.5, tasks: 2 },
      { date: "2026-10-03", hours: 0, tasks: 1 },
      { date: "2026-10-04", hours: 0, tasks: 0 },
    ]);
  });
  it("exports only the selected view with spreadsheet-safe text and numeric hours", () => {
    const row = task("1", 2, 5400, '=HYPERLINK("https://example.invalid")');
    const csv = reportCsv([row]);
    expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid"")"');
    expect(csv).toContain('"1.5","5400"');
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});

it("exports period time, lifetime time and estimate separately for ongoing work", () => {
  const row: ReportTask = {
    ...task("1", 2, 7200, "+unsafe"),
    completedAt: null,
    status: "in-progress",
    loggedAt: "2026-10-02",
    trackedSeconds: 36000,
    estimatedSeconds: 72000,
    progress: 45,
  };
  const csv = reportCsv([row], "logged");
  expect(csv).toContain(
    '"Period hours","Total hours","Estimated hours","Progress (%)"',
  );
  expect(csv).toContain('"2026-10-02","2","10","20","45","in-progress"');
  expect(csv).toContain('"\'+unsafe"');
});
