import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format, startOfMonth } from "date-fns";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { ReportActivityChart } from "@/components/project/reports/report-activity-chart";
import { ReportExportMenu } from "@/components/project/reports/report-export-menu";
import { ReportMetrics } from "@/components/project/reports/report-metrics";
import { ReportRangePicker } from "@/components/project/reports/report-range-picker";
import { ReportTasksTable } from "@/components/project/reports/report-tasks-table";
import { ReportTopTasks } from "@/components/project/reports/report-top-tasks";
import {
  type ReportMeasure,
  type ReportSort,
} from "@/components/project/reports/report-values";
import { completedReportPeriod } from "@/components/project/tasks-import-export/completed-report-period";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompletedReport } from "@/fetchers/task/get-completed-report";
import type { ReportFilters } from "@/fetchers/task/get-completed-report-page";
import { useCompletedReportTasks } from "@/hooks/queries/task/use-completed-report-tasks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type ReportSearch = {
  from?: string;
  to?: string;
  taskId?: string;
  day?: string;
  basis?: "logged" | "completed";
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/reports",
)({
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    basis: search.basis === "completed" ? "completed" : "logged",
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
    day:
      typeof search.day === "string" &&
      completedReportPeriod(search.day, search.day)
        ? search.day
        : undefined,
  }),
  component: ProjectReports,
});

function ProjectReports() {
  const { t } = useTranslation();
  const { workspaceId, projectId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const today = new Date();
  const validSearch =
    search.from && search.to && completedReportPeriod(search.from, search.to);
  const from = validSearch
    ? search.from!
    : format(startOfMonth(today), "yyyy-MM-dd");
  const to = validSearch ? search.to! : format(today, "yyyy-MM-dd");
  const period = completedReportPeriod(from, to)!;
  const basis = search.basis ?? "logged";
  const query = useQuery({
    queryKey: ["completed-reports", projectId, "summary", period, basis],
    queryFn: ({ signal }) =>
      getCompletedReport(projectId, period, signal, basis),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const [measure, setMeasure] = useState<ReportMeasure>("hours");
  const [text, setText] = useState("");
  const [zeroOnly, setZeroOnly] = useState(false);
  const [sort, setSort] = useState<ReportSort>("completed");
  const [pageSize, setPageSize] = useState(10);
  const debouncedText = useDebouncedValue(text.trim(), 300);
  const filters: ReportFilters = {
    search: debouncedText,
    day: search.day,
    zeroOnly: basis === "completed" && zeroOnly ? "true" : "false",
    sort,
  };
  const details = useCompletedReportTasks(
    projectId,
    period,
    filters,
    pageSize,
    basis,
  );
  const waitingForSearch = debouncedText !== text.trim();
  const setSearch = (change: Partial<ReportSearch>) =>
    navigate({ to: ".", replace: true, search: { ...search, ...change } });
  const selectTask = (taskId: string) => {
    void setSearch({ taskId });
  };
  return (
    <ProjectLayout
      workspaceId={workspaceId}
      projectId={projectId}
      activeView="reports"
      toolbarClassName="max-sm:h-auto max-sm:flex-wrap max-sm:py-2"
      summary={
        <div className="hidden min-w-0 items-center gap-3 text-[11px] text-muted-foreground xl:flex">
          <span>
            {query.isError
              ? t("tasks:reports.updateFailed")
              : query.dataUpdatedAt > 0
                ? t("tasks:reports.updatedAt", {
                    time: format(query.dataUpdatedAt, "HH:mm"),
                  })
                : null}
          </span>
        </div>
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={basis}
            onValueChange={(value) => {
              if (value === "logged" || value === "completed") {
                setZeroOnly(false);
                void setSearch({ basis: value, day: undefined });
              }
            }}
          >
            <TabsList className="h-8">
              <TabsTab value="logged" className="text-xs">
                {t("tasks:workReport.timeLogged")}
              </TabsTab>
              <TabsTab value="completed" className="text-xs">
                {t("tasks:workReport.completed")}
              </TabsTab>
            </TabsList>
          </Tabs>
          <ReportRangePicker
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => {
              void setSearch({ from: nextFrom, to: nextTo, day: undefined });
            }}
          />
          <ReportExportMenu
            basis={basis}
            projectId={projectId}
            period={period}
            from={from}
            to={to}
            disabled={
              details.isPending ||
              details.isFetching ||
              waitingForSearch ||
              !details.current?.summary.taskCount
            }
            filters={filters}
          />
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={t("tasks:reports.refresh")}
            disabled={query.isFetching || details.isFetching}
            onClick={() => {
              void query.refetch();
              void details.refetch();
            }}
          >
            <RefreshCw
              className={query.isFetching ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </Button>
        </div>
      }
    >
      <PageTitle title={t("tasks:reports.title")} />
      <div className="h-full overflow-y-auto" aria-busy={query.isFetching}>
        {query.isPending ? (
          <div className="flex flex-col gap-5 p-7">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : query.isError && !query.data ? (
          <div className="flex flex-col items-center gap-3 py-24">
            <p className="text-sm text-muted-foreground">
              {t("tasks:reports.loadFailed")}
            </p>
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              {t("tasks:reports.retry")}
            </Button>
          </div>
        ) : (
          query.data && (
            <>
              <ReportMetrics summary={query.data.summary} basis={basis} />
              <div className="grid lg:grid-cols-[minmax(0,1fr)_290px]">
                <ReportActivityChart
                  basis={basis}
                  activity={query.data.activity}
                  from={from}
                  to={to}
                  measure={measure}
                  onMeasureChange={setMeasure}
                  onDaySelect={(day) => {
                    void setSearch({
                      day: search.day === day ? undefined : day,
                    });
                  }}
                />
                <ReportTopTasks
                  tasks={query.data.topTasks}
                  total={query.data.summary.totalSeconds}
                  onTaskSelect={selectTask}
                />
              </div>
              <ReportTasksTable
                basis={basis}
                tasks={details.current?.tasks ?? []}
                totalCount={details.current?.summary.taskCount ?? 0}
                totalSeconds={details.current?.summary.totalSeconds ?? 0}
                page={details.page}
                pageSize={pageSize}
                busy={details.isFetching || waitingForSearch}
                pending={details.isPending}
                error={details.isError}
                onRetry={() => {
                  void details.refetch();
                }}
                onPage={(page) => {
                  void details.goToPage(page);
                }}
                onPageSize={setPageSize}
                search={text}
                onSearch={setText}
                day={search.day}
                onClearDay={() => {
                  void setSearch({ day: undefined });
                }}
                zeroOnly={zeroOnly}
                zeroCount={details.current?.summary.zeroCount ?? 0}
                onToggleZero={() => setZeroOnly(!zeroOnly)}
                onClearZero={() => setZeroOnly(false)}
                sort={sort}
                onSort={setSort}
                onTaskSelect={selectTask}
              />
              <div className="flex flex-col gap-1 px-5 py-3 text-[11px] text-muted-foreground sm:px-7">
                <p>
                  {t("tasks:reports.timeZone", { zone: period.timeZone })} ·{" "}
                  {basis === "logged"
                    ? t("tasks:workReport.periodHint")
                    : t("tasks:reports.currentTotals")}
                </p>
                {Boolean(query.data?.summary.unknownCompletionCount) && (
                  <p>
                    {t("tasks:reports.unknownDates", {
                      count: query.data!.summary.unknownCompletionCount,
                    })}
                  </p>
                )}
              </div>
            </>
          )
        )}
      </div>
      <TaskDetailsSheet
        taskId={search.taskId}
        projectId={projectId}
        workspaceId={workspaceId}
        onClose={() => {
          void setSearch({ taskId: undefined });
        }}
      />
    </ProjectLayout>
  );
}
