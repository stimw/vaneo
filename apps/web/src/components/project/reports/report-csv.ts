import type { ReportBasis } from "@/fetchers/task/get-completed-report";
import type { ReportTask } from "./report-values";

function cell(value: string | number | null) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function reportCsv(
  tasks: ReportTask[],
  basis: ReportBasis = "completed",
) {
  if (basis === "logged")
    return (
      "\ufeff" +
      [
        [
          "Task",
          "Title",
          "Category",
          "Assignee",
          "Last logged",
          "Period hours",
          "Total hours",
          "Progress (%)",
          "Status",
        ],
        ...tasks.map((task) => [
          task.ticketId,
          task.title,
          task.category ?? null,
          task.assigneeName,
          task.loggedAt ?? null,
          Number((task.totalSeconds / 3600).toFixed(4)),
          Number(((task.trackedSeconds ?? 0) / 3600).toFixed(4)),
          task.progress ?? null,
          task.status,
        ]),
      ]
        .map((row) => row.map(cell).join(","))
        .join("\r\n")
    );
  return (
    "\ufeff" +
    [
      [
        "Task",
        "Title",
        "Category",
        "Assignee",
        "Completed at",
        "Hours",
        "Seconds",
      ],
      ...tasks.map((task) => [
        task.ticketId,
        task.title,
        task.category ?? null,
        task.assigneeName,
        task.completedAt,
        Number((task.totalSeconds / 3600).toFixed(4)),
        task.totalSeconds,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
