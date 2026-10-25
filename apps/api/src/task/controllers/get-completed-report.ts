import { and, count, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  resolveReportCategory,
  type ReportCategoryQuery,
} from "../report-category";
import db from "../../database";
import { projectTable, taskTable, userTable } from "../../database/schema";
import {
  reportCompletionDay,
  reportOrder,
  reportPeriodWhere,
  reportTaskFields,
  reportTotals,
} from "../report-task-query";
import { taskIsCompleted } from "../task-is-completed";

export default async function getCompletedReport(
  projectId: string,
  period: { from: string; to: string; timeZone: string } & ReportCategoryQuery,
) {
  return db.transaction(
    async (tx) => {
      const project = await tx.query.projectTable.findFirst({
        where: eq(projectTable.id, projectId),
        columns: { id: true, name: true, slug: true },
      });
      if (!project)
        throw new HTTPException(404, { message: "Project not found" });
      const category = await resolveReportCategory(tx, projectId, period);
      const where = and(reportPeriodWhere(projectId, period), category.where);
      const categories = category.field
        ? await tx
            .select({
              category: category.value,
              taskCount: reportTotals.taskCount,
              totalSeconds: reportTotals.totalSeconds,
            })
            .from(taskTable)
            .where(where)
            .groupBy(sql`1`)
            .orderBy(sql`1`)
        : [];
      const [summary = { taskCount: 0, totalSeconds: 0, zeroCount: 0 }] =
        await tx.select(reportTotals).from(taskTable).where(where);
      const day = reportCompletionDay(period.timeZone).as("completion_day");
      const activity = await tx
        .select({ date: day, ...reportTotals })
        .from(taskTable)
        .where(where)
        .groupBy(({ date }) => date)
        .orderBy(({ date }) => date);
      const topTasks = await tx
        .select(reportTaskFields(project.slug, category.value))
        .from(taskTable)
        .leftJoin(userTable, eq(taskTable.userId, userTable.id))
        .where(where)
        .orderBy(...reportOrder("time"))
        .limit(3);
      const [unknown] = await tx
        .select({ count: count() })
        .from(taskTable)
        .where(
          and(
            eq(taskTable.projectId, projectId),
            taskIsCompleted,
            category.where,
            isNull(taskTable.completedAt),
          ),
        );
      return {
        generatedAt: new Date(),
        categoryField: category.field,
        categories,
        project,
        period: {
          ...period,
          from: new Date(period.from),
          to: new Date(period.to),
        },
        summary: { ...summary, unknownCompletionCount: unknown?.count ?? 0 },
        activity: activity.map(({ date, taskCount, totalSeconds }) => ({
          date,
          taskCount,
          totalSeconds,
        })),
        topTasks: topTasks.filter((task) => task.totalSeconds > 0),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
