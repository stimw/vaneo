import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  lt,
  or,
  sql,
  type SQLWrapper,
  type SQL,
} from "drizzle-orm";
import { taskTable, userTable } from "../database/schema";
import type { CompletedReportFilters } from "./completed-report-schema";
import { taskIsCompleted } from "./task-is-completed";

// completed_at is a UTC timestamp without time zone, so attach UTC before conversion.
export function reportLocalDay(column: SQLWrapper, timeZone: string) {
  // Intl also accepts fixed ISO offsets; PostgreSQL text zones use the opposite
  // POSIX sign convention for these, so apply the offset explicitly.
  const offset = /^([+-])(\d{2}):(\d{2})$/.exec(timeZone);
  if (offset) {
    const minutes =
      (Number(offset[2]) * 60 + Number(offset[3])) *
      (offset[1] === "-" ? -1 : 1);
    return sql<string>`to_char(${column} + ${minutes} * interval '1 minute', 'YYYY-MM-DD')`;
  }
  return sql<string>`to_char(${column} AT TIME ZONE 'UTC' AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`;
}

export function reportCompletionDay(timeZone: string) {
  return reportLocalDay(taskTable.completedAt, timeZone);
}

export function reportPeriodWhere(
  projectId: string,
  period: { from: string; to: string },
) {
  return and(
    eq(taskTable.projectId, projectId),
    or(taskIsCompleted, eq(taskTable.status, "archived")),
    gte(taskTable.completedAt, new Date(period.from)),
    lt(taskTable.completedAt, new Date(period.to)),
  );
}

export function reportFilterWhere(
  slug: string,
  filters: Pick<CompletedReportFilters, "search" | "day" | "timeZone">,
) {
  const search = filters.search.replace(/[\\%_]/g, "\\$&");
  return and(
    filters.day
      ? eq(reportCompletionDay(filters.timeZone), filters.day)
      : undefined,
    search
      ? ilike(
          sql`concat_ws(' ', ${taskTable.title}, ${slug} || '-' || ${taskTable.number}, ${userTable.name})`,
          `%${search}%`,
        )
      : undefined,
  );
}

export const reportTotals = {
  taskCount: sql<number>`count(*)`.mapWith(Number),
  totalSeconds:
    sql<number>`coalesce(sum(${taskTable.trackedSeconds}), 0)`.mapWith(Number),
  zeroCount:
    sql<number>`count(*) filter (where ${taskTable.trackedSeconds} = 0)`.mapWith(
      Number,
    ),
};

export function reportTaskFields(
  slug: string,
  category: SQL<string | null> = sql`null::text`,
) {
  return {
    category,
    id: taskTable.id,
    ticketId: sql<string>`${slug} || '-' || ${taskTable.number}`,
    title: taskTable.title,
    status: taskTable.status,
    completedAt: sql<Date>`${taskTable.completedAt}`.mapWith(
      taskTable.completedAt,
    ),
    assigneeId: taskTable.userId,
    assigneeName: userTable.name,
    totalSeconds: taskTable.trackedSeconds,
  };
}

export function reportOrder(sort: "completed" | "time") {
  return [
    sort === "time"
      ? desc(taskTable.trackedSeconds)
      : desc(taskTable.completedAt),
    asc(taskTable.number),
    asc(taskTable.id),
  ];
}
