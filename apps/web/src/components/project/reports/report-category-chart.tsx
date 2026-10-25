import { useTranslation } from "react-i18next";
import { Check, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { reportHours } from "./report-values";
import {
  categoryBreakdown,
  categoryPercent,
  type CategoryTotal,
} from "./category-breakdown";

export function ReportCategoryChart({
  options,
  totals,
  selected,
  onSelect,
}: {
  options: string[];
  totals: CategoryTotal[];
  selected?: string;
  onSelect: (category?: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { rows, totalSeconds } = categoryBreakdown(options, totals);
  const circumference = 2 * Math.PI * 70;
  return (
    <div className="grid gap-5 pt-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center sm:gap-8">
      <div className="relative mx-auto size-44 sm:size-48">
        <svg
          viewBox="0 0 180 180"
          className="size-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="17"
          />
          {rows
            .filter((row) => row.totalSeconds > 0)
            .map((row) => (
              <circle
                key={row.category ?? ""}
                cx="90"
                cy="90"
                r="70"
                fill="none"
                stroke={row.color}
                strokeWidth="17"
                strokeDasharray={`${Math.max(0, (row.percent / 100) * circumference - (row.percent < 100 ? 2 : 0))} ${circumference}`}
                strokeDashoffset={-(row.offset / 100) * circumference}
                opacity={
                  selected === undefined || selected === (row.category ?? "")
                    ? 1
                    : 0.35
                }
              />
            ))}
        </svg>
        <div className="absolute inset-7 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-medium tracking-tight tabular-nums">
            {reportHours(totalSeconds)}
            <span className="ml-1 text-sm text-muted-foreground">
              {t("tasks:reports.hoursUnit")}
            </span>
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            {t("tasks:reports.wholePeriod")}
          </span>
        </div>
      </div>
      <ul
        className="min-w-0 space-y-1"
        aria-label={t("tasks:reports.categoryBreakdown")}
      >
        {rows.map((row) => {
          const active = selected === (row.category ?? "");
          const name = row.category ?? t("tasks:reports.uncategorized");
          const percent = categoryPercent(row.percent, i18n.language);
          return (
            <li key={row.category ?? ""}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onSelect(active ? undefined : (row.category ?? ""))
                }
                className={cn(
                  "group w-full rounded-lg border border-transparent px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
                  active && "border-border bg-muted/50",
                )}
                aria-label={t("tasks:reports.categoryRow", {
                  name,
                  hours: reportHours(row.totalSeconds),
                  percent,
                  count: row.taskCount,
                })}
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 break-words font-medium">
                    {name}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {reportHours(row.totalSeconds)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {t("tasks:reports.hoursUnit")}
                    </span>
                  </span>
                  <span className="hidden w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:block">
                    {percent}
                  </span>
                  {active ? (
                    <Check
                      className="hidden size-3.5 shrink-0 sm:block"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowUpRight
                      className="hidden size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 sm:block"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3 pl-4.5">
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${row.percent}%`,
                        backgroundColor: row.color,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {t("tasks:reports.categoryTasks", { count: row.taskCount })}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums sm:hidden">
                    {percent}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {totalSeconds === 0 && (
        <p className="text-center text-sm text-muted-foreground sm:col-span-2">
          {t("tasks:reports.noTimeYet")}
        </p>
      )}
    </div>
  );
}
