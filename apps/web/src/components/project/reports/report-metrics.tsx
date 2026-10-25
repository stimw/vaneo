import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { formatTrackedTime } from "@/components/task/time-tracking/time-values";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReportBasis } from "@/fetchers/task/get-completed-report";
import type { ReportSummary } from "./report-values";

export function ReportMetrics({
  summary,
  basis = "completed",
}: {
  summary: ReportSummary["summary"];
  basis?: ReportBasis;
}) {
  const { t } = useTranslation();
  const seconds = summary.totalSeconds;
  return (
    <div
      className="grid grid-cols-2 divide-x border-b sm:grid-cols-3"
      aria-label={t("tasks:reports.periodSummary")}
    >
      <div className="col-span-2 flex flex-col gap-1 border-b px-5 py-4 sm:col-span-1 sm:border-b-0 sm:px-7 sm:py-5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>
            {basis === "logged"
              ? t("tasks:workReport.timeLogged")
              : t("tasks:reports.completedTaskTime")}
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("tasks:reports.howCalculated")}
                />
              }
            >
              <Info className="size-3.5" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipPopup className="max-w-80">
              {basis === "logged"
                ? t("tasks:workReport.calculation")
                : t("tasks:reports.calculationDetails")}
            </TooltipPopup>
          </Tooltip>
        </div>
        <span className="text-2xl font-medium tracking-tight tabular-nums sm:text-3xl">
          {formatTrackedTime(seconds)}
        </span>
      </div>
      <div className="flex flex-col gap-1 px-5 py-5 sm:px-7">
        <span className="text-xs text-muted-foreground">
          {basis === "logged"
            ? t("tasks:workReport.tasksWorked")
            : t("tasks:reports.completedTasks")}
        </span>
        <span className="text-2xl font-medium tracking-tight tabular-nums sm:text-3xl">
          {summary.taskCount}
        </span>
      </div>
      <div className="flex flex-col items-start gap-1 px-5 py-5 sm:px-7">
        <span className="text-xs text-muted-foreground">
          {t("tasks:reports.averageTime")}
        </span>
        <span className="text-2xl font-medium tracking-tight tabular-nums sm:text-3xl">
          {formatTrackedTime(
            summary.taskCount
              ? Math.round(seconds / summary.taskCount / 60) * 60
              : 0,
          )}
        </span>
      </div>
    </div>
  );
}
