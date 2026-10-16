import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { getCompletedReport } from "@/fetchers/task/get-completed-report";
import type { getCompletedReportPage } from "@/fetchers/task/get-completed-report-page";

export type ReportSummary = Awaited<ReturnType<typeof getCompletedReport>>;
export type ReportTask = Awaited<
  ReturnType<typeof getCompletedReportPage>
>["tasks"][number];
export type ReportMeasure = "hours" | "tasks";
export type ReportSort = "completed" | "time";

export function reportActivity(
  activity: ReportSummary["activity"],
  from: string,
  to: string,
) {
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  const grouped = new Map(
    days.map((date) => [
      format(date, "yyyy-MM-dd"),
      { date: format(date, "yyyy-MM-dd"), hours: 0, tasks: 0 },
    ]),
  );
  for (const entry of activity) {
    const day = grouped.get(entry.date);
    if (day) {
      day.hours += entry.totalSeconds / 3600;
      day.tasks += entry.taskCount;
    }
  }
  return [...grouped.values()];
}

export function reportHours(seconds: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(
    seconds / 3600,
  );
}
