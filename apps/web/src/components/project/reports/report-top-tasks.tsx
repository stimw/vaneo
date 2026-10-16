import { useTranslation } from "react-i18next";
import { formatTrackedTime } from "@/components/task/time-tracking/time-values";
import { reportHours, type ReportTask } from "./report-values";

export function ReportTopTasks({
  tasks,
  total,
  onTaskSelect,
}: {
  tasks: ReportTask[];
  total: number;
  onTaskSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const top = tasks;
  return (
    <section
      className="hidden min-w-0 border-l px-5 py-5 lg:block"
      aria-label={t("tasks:reports.mostTime")}
    >
      <h2 className="text-sm font-medium">{t("tasks:reports.mostTime")}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {t("tasks:reports.shareOfPeriodTime")}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {top.map((task) => (
          <button
            type="button"
            key={task.id}
            onClick={() => onTaskSelect(task.id)}
            className="-mx-2 -my-1 flex min-w-0 flex-col gap-1.5 rounded-md px-2 py-1 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${task.ticketId} ${task.title}`}
          >
            <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
              <span className="truncate">{task.title}</span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatTrackedTime(task.totalSeconds)}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-sm bg-muted"
              aria-label={`${reportHours(task.totalSeconds)}h / ${reportHours(total)}h`}
            >
              <div
                className="h-full rounded-sm bg-chart-1/70"
                style={{ width: `${(100 * task.totalSeconds) / total}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              {task.ticketId} · {Math.round((100 * task.totalSeconds) / total)}%
            </span>
          </button>
        ))}
        {!top.length && (
          <p className="text-sm text-muted-foreground">
            {t("tasks:reports.noTimeYet")}
          </p>
        )}
      </div>
    </section>
  );
}
