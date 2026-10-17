import { format, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import type { ReportBasis } from "@/fetchers/task/get-completed-report";
import { cn } from "@/lib/cn";
import {
  reportActivity,
  type ReportMeasure,
  type ReportSummary,
} from "./report-values";

export function ReportActivityChart({
  activity,
  basis = "completed",
  from,
  to,
  measure,
  onMeasureChange,
  onDaySelect,
}: {
  activity: ReportSummary["activity"];
  basis?: ReportBasis;
  from: string;
  to: string;
  measure: ReportMeasure;
  onMeasureChange: (measure: ReportMeasure) => void;
  onDaySelect: (day: string) => void;
}) {
  const { t } = useTranslation();
  const data = reportActivity(activity, from, to);
  return (
    <section
      className="min-w-0 px-5 pt-5 pb-3 sm:px-7"
      aria-label={
        basis === "logged"
          ? t("tasks:workReport.activity")
          : t("tasks:reports.completionActivity")
      }
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">
            {basis === "logged"
              ? t("tasks:workReport.activity")
              : t("tasks:reports.completionActivity")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {basis === "logged"
              ? t("tasks:workReport.groupedByDate")
              : t("tasks:reports.groupedByCompletionDate")}
          </p>
        </div>
        <div
          className="flex gap-0.5 rounded-lg bg-muted/70 p-0.5"
          role="group"
          aria-label={t("tasks:reports.chartMeasure")}
        >
          {(["hours", "tasks"] as const).map((value) => (
            <Button
              key={value}
              size="xs"
              variant="ghost"
              aria-pressed={measure === value}
              className={cn(measure === value && "bg-background shadow-xs/5")}
              onClick={() => onMeasureChange(value)}
            >
              {value === "hours"
                ? t("tasks:reports.hours")
                : t("tasks:reports.tasks")}
            </Button>
          ))}
        </div>
      </div>
      <ChartContainer
        className="mt-4 h-48 w-full aspect-auto"
        config={{
          hours: { label: t("tasks:reports.hours"), color: "var(--chart-1)" },
          tasks: { label: t("tasks:reports.tasks"), color: "var(--chart-1)" },
        }}
        aria-label={
          basis === "logged"
            ? t("tasks:workReport.chartDescription")
            : t("tasks:reports.chartDescription")
        }
      >
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 8, right: 6, bottom: 0, left: -19 }}
          onClick={(state) => {
            if (typeof state.activeLabel === "string")
              onDaySelect(state.activeLabel);
          }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 4" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={25}
            tickFormatter={(value) => format(parseISO(String(value)), "MMM d")}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={measure === "hours"}
            tickFormatter={(value) =>
              `${value}${measure === "hours" ? "h" : ""}`
            }
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.65 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  format(parseISO(payload[0]?.payload.date), "EEE, MMM d")
                }
              />
            }
          />
          <Bar
            dataKey={measure}
            fill={`var(--color-${measure})`}
            radius={[3, 3, 0, 0]}
            maxBarSize={30}
            isAnimationActive={false}
            className="cursor-pointer"
          />
        </BarChart>
      </ChartContainer>
    </section>
  );
}
