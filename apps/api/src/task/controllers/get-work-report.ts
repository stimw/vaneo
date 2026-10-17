import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  projectTable,
  taskTable,
  taskWorklogTable,
  timeEntryTable,
  userTable,
} from "../../database/schema";
import { boundedTaskRead } from "../bounded-read";
import type { CompletedReportPageQuery } from "../completed-report-schema";
import { reportLocalDay } from "../report-task-query";
import { taskIsCompleted } from "../task-is-completed";

function localDate(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)!.value)
    .join("-");
}

type WorkTask = {
  id: string;
  ticketId: string;
  title: string;
  status: string;
  completedAt: Date | null;
  loggedAt: string;
  assigneeId: string | null;
  assigneeName: string | null;
  totalSeconds: number;
  trackedSeconds: number;
  estimatedSeconds: number | null;
  progress: number | null;
};

export async function getWorkReport(
  projectId: string,
  query: CompletedReportPageQuery,
) {
  return boundedTaskRead(async (tx) => {
    const project = await tx.query.projectTable.findFirst({
      where: eq(projectTable.id, projectId),
      columns: { id: true, name: true, slug: true },
    });
    if (!project)
      throw new HTTPException(404, { message: "Project not found" });
    const fromDay = localDate(query.from, query.timeZone);
    const toDay = localDate(query.to, query.timeZone);
    const timerDay = reportLocalDay(timeEntryTable.startTime, query.timeZone);
    const search = query.search.replace(/[\\%_]/g, "\\$&");
    // Timer entries belong to their start day; date-only logs use their explicit work date.
    // Running timers and undated historical balances are excluded from period reporting.
    const common = sql`WITH logs AS (
      SELECT ${taskWorklogTable.taskId} AS task_id, ${taskWorklogTable.workDate}::text AS day, ${taskWorklogTable.duration}::bigint AS seconds
      FROM ${taskWorklogTable} JOIN ${taskTable} ON ${taskTable.id} = ${taskWorklogTable.taskId}
      WHERE ${taskTable.projectId} = ${projectId} AND ${taskWorklogTable.workDate} >= ${fromDay}::date AND ${taskWorklogTable.workDate} < ${toDay}::date
      UNION ALL
      SELECT ${timeEntryTable.taskId}, ${timerDay}, greatest(0, floor(extract(epoch FROM (${timeEntryTable.endTime} - ${timeEntryTable.startTime}))))::bigint
      FROM ${timeEntryTable} JOIN ${taskTable} ON ${taskTable.id} = ${timeEntryTable.taskId}
      WHERE ${taskTable.projectId} = ${projectId} AND ${timeEntryTable.endTime} IS NOT NULL
        AND ${timeEntryTable.startTime} >= ${new Date(query.from)} AND ${timeEntryTable.startTime} < ${new Date(query.to)}
        AND ${timeEntryTable.endTime} > ${timeEntryTable.startTime}
    ), filtered_logs AS (SELECT * FROM logs ${query.day ? sql`WHERE day = ${query.day}` : sql``}),
    grouped AS (SELECT task_id, sum(seconds)::float8 AS seconds, max(day) AS day FROM filtered_logs GROUP BY task_id),
    rows AS (
      SELECT ${taskTable.id} AS id, ${project.slug} || '-' || ${taskTable.number} AS "ticketId", ${taskTable.title} AS title,
        ${taskTable.status} AS status, ${taskTable.completedAt} AT TIME ZONE 'UTC' AS "completedAt", grouped.day AS "loggedAt",
        ${taskTable.userId} AS "assigneeId", ${userTable.name} AS "assigneeName", grouped.seconds AS "totalSeconds",
        ${taskTable.trackedSeconds}::float8 AS "trackedSeconds", ${taskTable.estimatedSeconds}::float8 AS "estimatedSeconds",
        CASE WHEN ${taskIsCompleted} THEN 100 ELSE ${taskTable.progress} END AS progress, ${taskTable.number} AS number
      FROM grouped JOIN ${taskTable} ON ${taskTable.id} = grouped.task_id
      LEFT JOIN ${userTable} ON ${userTable.id} = ${taskTable.userId}
      WHERE ${search ? sql`concat_ws(' ', ${taskTable.title}, ${project.slug} || '-' || ${taskTable.number}, ${userTable.name}) ILIKE ${`%${search}%`}` : sql`true`}
        AND ${query.zeroOnly === "true" ? sql`false` : sql`true`}
    )`;
    const summary = (
      await tx.execute<{
        taskCount: number;
        totalSeconds: number;
        zeroCount: number;
        unknownCompletionCount: number;
      }>(sql`${common}
      SELECT count(*)::int AS "taskCount", coalesce(sum("totalSeconds"), 0)::float8 AS "totalSeconds", 0 AS "zeroCount", 0 AS "unknownCompletionCount" FROM rows`)
    ).rows[0]!;
    const activity = (
      await tx.execute<{
        date: string;
        taskCount: number;
        totalSeconds: number;
      }>(sql`${common}
      SELECT filtered_logs.day AS date, count(DISTINCT task_id)::int AS "taskCount", sum(seconds)::float8 AS "totalSeconds"
      FROM filtered_logs JOIN rows ON rows.id = filtered_logs.task_id GROUP BY filtered_logs.day ORDER BY filtered_logs.day`)
    ).rows;
    const fields = sql`id, "ticketId", title, status, "completedAt", "loggedAt", "assigneeId", "assigneeName", "totalSeconds", "trackedSeconds", "estimatedSeconds", progress`;
    const topTasks = (
      await tx.execute<WorkTask>(
        sql`${common} SELECT ${fields} FROM rows ORDER BY "totalSeconds" DESC, number, id LIMIT 3`,
      )
    ).rows;
    const tasks = (
      await tx.execute<WorkTask>(
        sql`${common} SELECT ${fields} FROM rows ORDER BY ${query.sort === "time" ? sql`"totalSeconds"` : sql`"loggedAt"`} DESC, number, id LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
      )
    ).rows;
    return {
      generatedAt: new Date(),
      project,
      period: {
        from: new Date(query.from),
        to: new Date(query.to),
        timeZone: query.timeZone,
      },
      summary,
      activity,
      topTasks,
      tasks,
      page: query.page,
      limit: query.limit,
      nextPage:
        query.page * query.limit < summary.taskCount ? query.page + 1 : null,
    };
  }, "Work report took too long; narrow the date range and retry");
}
