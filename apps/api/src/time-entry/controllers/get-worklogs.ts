import { and, desc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  taskTable,
  taskWorklogTable,
  timeEntryTable,
  userTable,
} from "../../database/schema";

export async function getWorklogs(taskId: string, page: number, limit: number) {
  return db.transaction(
    async (tx) => {
      const [task] = await tx
        .select({ totalSeconds: taskTable.trackedSeconds })
        .from(taskTable)
        .where(eq(taskTable.id, taskId));
      if (!task) throw new HTTPException(404, { message: "Task not found" });
      const [summary = { total: 0, loggedSeconds: 0 }] = await tx
        .select({
          total: sql<number>`count(*)`.mapWith(Number),
          loggedSeconds:
            sql<number>`coalesce(sum(${taskWorklogTable.duration}), 0)`.mapWith(
              Number,
            ),
        })
        .from(taskWorklogTable)
        .where(eq(taskWorklogTable.taskId, taskId));
      const [timers = { seconds: 0 }] = await tx
        .select({
          seconds:
            sql<number>`coalesce(sum(greatest(0, extract(epoch from (${timeEntryTable.endTime} - ${timeEntryTable.startTime})))), 0)`.mapWith(
              Number,
            ),
        })
        .from(timeEntryTable)
        .where(
          and(
            eq(timeEntryTable.taskId, taskId),
            sql`${timeEntryTable.endTime} is not null`,
          ),
        );
      const entries = await tx
        .select({
          id: taskWorklogTable.id,
          workDate: taskWorklogTable.workDate,
          duration: taskWorklogTable.duration,
          userName: userTable.name,
          createdAt: taskWorklogTable.createdAt,
        })
        .from(taskWorklogTable)
        .leftJoin(userTable, eq(taskWorklogTable.userId, userTable.id))
        .where(eq(taskWorklogTable.taskId, taskId))
        .orderBy(desc(taskWorklogTable.workDate), desc(taskWorklogTable.id))
        .limit(limit)
        .offset((page - 1) * limit);
      return {
        entries,
        total: summary.total,
        totalSeconds: task.totalSeconds,
        unallocatedSeconds:
          task.totalSeconds - summary.loggedSeconds - timers.seconds,
        nextPage: page * limit < summary.total ? page + 1 : null,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
