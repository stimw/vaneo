import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskTable,
  taskWorklogTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

export async function saveWorklog(input: {
  taskId: string;
  workspaceId: string;
  userId: string;
  id?: string;
  workDate: string;
  duration: number;
}) {
  const { taskId, workspaceId, userId, id, workDate, duration } = input;
  const result = await db.transaction(async (tx) => {
    const [task] = await tx
      .select({ projectId: taskTable.projectId })
      .from(taskTable)
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .where(
        and(
          eq(taskTable.id, taskId),
          eq(projectTable.workspaceId, workspaceId),
        ),
      )
      .for("update", { of: taskTable });
    if (!task) throw new HTTPException(404, { message: "Task not found" });
    const [entry] = id
      ? await tx
          .update(taskWorklogTable)
          .set({ workDate, duration })
          .where(
            and(
              eq(taskWorklogTable.id, id),
              eq(taskWorklogTable.taskId, taskId),
            ),
          )
          .returning()
      : await tx
          .insert(taskWorklogTable)
          .values({ taskId, userId, workDate, duration })
          .returning();
    if (!entry) throw new HTTPException(404, { message: "Time log not found" });
    return { entry, projectId: task.projectId };
  });
  await publishEvent("time-entry.total-updated", {
    taskId,
    projectId: result.projectId,
  });
  return result.entry;
}
