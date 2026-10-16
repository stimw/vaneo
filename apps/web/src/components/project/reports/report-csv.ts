import type { ReportTask } from "./report-values";

function cell(value: string | number | null) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function reportCsv(tasks: ReportTask[]) {
  return (
    "\ufeff" +
    [
      ["Task", "Title", "Assignee", "Completed at", "Hours", "Seconds"],
      ...tasks.map((task) => [
        task.ticketId,
        task.title,
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
