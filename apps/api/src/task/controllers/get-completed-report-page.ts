import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { resolveReportCategory } from "../report-category";
import db from "../../database";
import { projectTable, taskTable, userTable } from "../../database/schema";
import type { CompletedReportPageQuery } from "../completed-report-schema";
import {
  reportFilterWhere,
  reportOrder,
  reportPeriodWhere,
  reportTaskFields,
  reportTotals,
} from "../report-task-query";

export default async function getCompletedReportPage(
  projectId: string,
  query: CompletedReportPageQuery,
) {
  return db.transaction(
    async (tx) => {
      const project = await tx.query.projectTable.findFirst({
        where: eq(projectTable.id, projectId),
        columns: { slug: true },
      });
      if (!project)
        throw new HTTPException(404, { message: "Project not found" });
      const category = await resolveReportCategory(tx, projectId, query);
      const baseWhere = and(
        category.where,
        reportPeriodWhere(projectId, query),
        reportFilterWhere(project.slug, query),
      );
      const [baseTotals = { taskCount: 0, totalSeconds: 0, zeroCount: 0 }] =
        await tx
          .select(reportTotals)
          .from(taskTable)
          .leftJoin(userTable, eq(taskTable.userId, userTable.id))
          .where(baseWhere);
      const zeroOnly = query.zeroOnly === "true";
      const where = and(
        baseWhere,
        zeroOnly ? eq(taskTable.trackedSeconds, 0) : undefined,
      );
      const summary = zeroOnly
        ? {
            taskCount: baseTotals.zeroCount,
            totalSeconds: 0,
            zeroCount: baseTotals.zeroCount,
          }
        : baseTotals;
      const tasks = await tx
        .select(reportTaskFields(project.slug, category.value))
        .from(taskTable)
        .leftJoin(userTable, eq(taskTable.userId, userTable.id))
        .where(where)
        .orderBy(...reportOrder(query.sort))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);
      return {
        tasks,
        summary,
        page: query.page,
        limit: query.limit,
        nextPage:
          query.page * query.limit < summary.taskCount ? query.page + 1 : null,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
