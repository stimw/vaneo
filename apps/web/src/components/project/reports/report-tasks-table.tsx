import { format, parseISO } from "date-fns";
import {
  ArrowDown,
  ArrowDownWideNarrow,
  CircleCheck,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatTrackedTime } from "@/components/task/time-tracking/time-values";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import type { ReportSort, ReportTask } from "./report-values";
import { ReportPagination } from "./report-pagination";

export function ReportTasksTable({
  tasks,
  totalCount,
  totalSeconds,
  page,
  pageSize,
  busy,
  pending,
  error,
  onRetry,
  onPage,
  onPageSize,
  search,
  onSearch,
  day,
  onClearDay,
  zeroOnly,
  zeroCount,
  onToggleZero,
  onClearZero,
  sort,
  onSort,
  onTaskSelect,
}: {
  tasks: ReportTask[];
  totalCount: number;
  totalSeconds: number;
  page: number;
  pageSize: number;
  busy: boolean;
  pending: boolean;
  error: boolean;
  onRetry: () => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  search: string;
  onSearch: (search: string) => void;
  day?: string;
  onClearDay: () => void;
  zeroOnly: boolean;
  zeroCount: number;
  onToggleZero: () => void;
  onClearZero: () => void;
  sort: ReportSort;
  onSort: (sort: ReportSort) => void;
  onTaskSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="border-t"
      aria-label={t("tasks:reports.taskDetails")}
      aria-busy={busy}
    >
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium">
            {t("tasks:reports.completedTasks")}
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {pending ? "—" : totalCount}
          </span>
          {zeroCount > 0 && !zeroOnly && (
            <Button
              size="xs"
              variant="ghost"
              className="text-muted-foreground"
              onClick={onToggleZero}
            >
              {t("tasks:reports.zeroCount", { count: zeroCount })}
            </Button>
          )}
          {day && (
            <Button
              size="xs"
              variant="secondary"
              onClick={onClearDay}
              aria-label={t("tasks:reports.clearDateFilter")}
            >
              {format(parseISO(day), "MMM d")}
              <X aria-hidden="true" />
            </Button>
          )}
          {zeroOnly && (
            <Button
              size="xs"
              variant="secondary"
              onClick={onClearZero}
              aria-label={t("tasks:reports.clearZeroFilter")}
            >
              {t("tasks:reports.zeroHours")}
              <X aria-hidden="true" />
            </Button>
          )}
        </div>
        <InputGroup className="h-7 w-52 sm:w-56">
          <InputGroupInput
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            aria-label={t("tasks:reports.searchTasks")}
            placeholder={t("tasks:reports.searchTasks")}
            maxLength={200}
            className="text-xs"
          />
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
        </InputGroup>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 px-5 pb-3 text-xs text-muted-foreground sm:px-7"
        >
          {t("tasks:reports.loadFailed")}
          <Button size="xs" variant="outline" onClick={onRetry}>
            {t("tasks:reports.retry")}
          </Button>
        </div>
      )}
      <Table
        className="w-full table-fixed"
        aria-label={t("tasks:reports.taskDetails")}
      >
        <TableHeader className="bg-muted/25">
          <TableRow>
            <TableHead className="ps-5 text-xs sm:ps-7">
              {t("tasks:reports.task")}
            </TableHead>
            <TableHead className="hidden w-40 text-xs md:table-cell">
              {t("tasks:reports.assignee")}
            </TableHead>
            <TableHead
              className="hidden w-36 text-xs sm:table-cell"
              aria-sort={sort === "completed" ? "descending" : "none"}
            >
              <button
                type="button"
                onClick={() => onSort("completed")}
                className="flex items-center gap-1.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("tasks:reports.completed")}
                <ArrowDown
                  aria-hidden="true"
                  className={cn("size-3", sort !== "completed" && "opacity-0")}
                />
              </button>
            </TableHead>
            <TableHead
              className="w-28 pe-5 text-right text-xs sm:pe-7"
              aria-sort={sort === "time" ? "descending" : "none"}
            >
              <button
                type="button"
                onClick={() => onSort("time")}
                className="ms-auto flex items-center gap-1.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("tasks:reports.time")}
                <ArrowDownWideNarrow
                  aria-hidden="true"
                  className={cn(
                    "size-3",
                    sort !== "time" && "text-muted-foreground/50",
                  )}
                />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="before:hidden">
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              className="cursor-pointer focus-within:bg-muted/72"
              onClick={() => onTaskSelect(task.id)}
            >
              <TableCell className="ps-5 py-3 sm:ps-7">
                <div className="flex min-w-0 items-center gap-3">
                  <CircleCheck
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground/70"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <button
                      type="button"
                      data-task-id={task.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onTaskSelect(task.id);
                      }}
                      className="truncate text-left text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {task.title}
                    </button>
                    <span className="text-[11px] text-muted-foreground">
                      {task.ticketId}
                      <span className="sm:hidden">
                        {" "}
                        · {format(parseISO(task.completedAt), "MMM d")}
                      </span>
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                <span className="block truncate">
                  {task.assigneeName ?? t("tasks:reports.unassigned")}
                </span>
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                {format(parseISO(task.completedAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell
                className={cn(
                  "pe-5 text-right text-sm tabular-nums sm:pe-7",
                  task.totalSeconds ? "font-medium" : "text-muted-foreground",
                )}
              >
                {formatTrackedTime(task.totalSeconds)}
              </TableCell>
            </TableRow>
          ))}
          {pending && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-40 text-center text-xs text-muted-foreground"
              >
                {t("tasks:reports.loadingTasks")}
              </TableCell>
            </TableRow>
          )}
          {!tasks.length && !pending && !error && (
            <TableRow>
              <TableCell colSpan={4} className="py-14 text-center">
                <p className="text-sm font-medium">
                  {t("tasks:reports.noTasks")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("tasks:reports.tryDifferentFilters")}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter className="bg-muted/20">
          <TableRow>
            <TableCell className="ps-5 text-xs font-normal text-muted-foreground sm:ps-7">
              {t("tasks:reports.viewTotal")}
            </TableCell>
            <TableCell className="hidden md:table-cell" />
            <TableCell className="hidden sm:table-cell" />
            <TableCell className="pe-5 text-right text-sm tabular-nums sm:pe-7">
              {pending ? "—" : formatTrackedTime(totalSeconds)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <ReportPagination
        page={page}
        pageSize={pageSize}
        total={totalCount}
        busy={busy || pending}
        onPage={onPage}
        onPageSize={onPageSize}
      />
    </section>
  );
}
