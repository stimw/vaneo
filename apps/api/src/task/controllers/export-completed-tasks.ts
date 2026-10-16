import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskTable,
  timeEntryTable,
  userTable,
} from "../../database/schema";
import { taskIsCompleted } from "../task-is-completed";
import type { CompletedReportFilters } from "../completed-report-schema";
import {
  reportFilterWhere,
  reportOrder,
  reportPeriodWhere,
} from "../report-task-query";

export default async function exportCompletedTasks(
  projectId: string,
  period: { from: string; to: string; timeZone: string },
  filters: Partial<
    Pick<CompletedReportFilters, "search" | "day" | "zeroOnly" | "sort">
  > = {},
) {
  // A report must describe one snapshot even if tasks/timers change mid-export.
  return db.transaction(
    async (tx) => {
      const project = await tx.query.projectTable.findFirst({
        where: eq(projectTable.id, projectId),
        columns: { id: true, name: true, slug: true },
      });
      if (!project)
        throw new HTTPException(404, { message: "Project not found" });
      const rows = await tx
        .select({
          id: taskTable.id,
          title: taskTable.title,
          description: taskTable.description,
          number: taskTable.number,
          status: taskTable.status,
          completedAt: taskTable.completedAt,
          totalSeconds: taskTable.trackedSeconds,
          assigneeId: taskTable.userId,
          assigneeName: userTable.name,
        })
        .from(taskTable)
        .leftJoin(userTable, eq(taskTable.userId, userTable.id))
        .where(
          and(
            reportPeriodWhere(projectId, period),
            reportFilterWhere(project.slug, {
              search: filters.search ?? "",
              day: filters.day,
              timeZone: period.timeZone,
            }),
            filters.zeroOnly === "true"
              ? eq(taskTable.trackedSeconds, 0)
              : undefined,
          ),
        )
        .orderBy(
          ...(filters.sort
            ? reportOrder(filters.sort)
            : [
                asc(taskTable.completedAt),
                asc(taskTable.number),
                asc(taskTable.id),
              ]),
        )
        .limit(10_001);
      if (rows.length > 10_000)
        throw new HTTPException(400, {
          message: "The report exceeds 10,000 tasks. Select a shorter period.",
        });
      const ids = rows.map((task) => task.id);
      const entries = ids.length
        ? await tx
            .select({
              id: timeEntryTable.id,
              taskId: timeEntryTable.taskId,
              userId: timeEntryTable.userId,
              userName: userTable.name,
              description: timeEntryTable.description,
              startTime: timeEntryTable.startTime,
              endTime: timeEntryTable.endTime,
              duration: timeEntryTable.duration,
              createdAt: timeEntryTable.createdAt,
              updatedAt: timeEntryTable.updatedAt,
            })
            .from(timeEntryTable)
            .leftJoin(userTable, eq(timeEntryTable.userId, userTable.id))
            .where(inArray(timeEntryTable.taskId, ids))
            .orderBy(timeEntryTable.startTime, timeEntryTable.id)
        : [];
      const byTask = new Map<string, typeof entries>();
      for (const entry of entries) {
        const list = byTask.get(entry.taskId) ?? [];
        list.push(entry);
        byTask.set(entry.taskId, list);
      }
      const tasks = rows.map((task) => {
        const timeEntries = byTask.get(task.id) ?? [];
        const { number, completedAt, ...details } = task;
        return {
          ...details,
          ticketId: `${project.slug}-${number}`,
          completedAt: completedAt!,
          timeEntries,
        };
      });
      const [unknown] = await tx
        .select({ count: count() })
        .from(taskTable)
        .where(
          and(
            eq(taskTable.projectId, projectId),
            taskIsCompleted,
            isNull(taskTable.completedAt),
          ),
        );
      return {
        version: 1 as const,
        exportedAt: new Date(),
        project,
        period: {
          timeZone: period.timeZone,
          from: new Date(period.from),
          to: new Date(period.to),
        },
        summary: {
          taskCount: tasks.length,
          totalSeconds: tasks.reduce((sum, task) => sum + task.totalSeconds, 0),
          runningEntryCount: entries.filter((entry) => !entry.endTime).length,
          unknownCompletionCount: unknown?.count ?? 0,
        },
        tasks,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
