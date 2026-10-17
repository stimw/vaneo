import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskTable,
  taskWorklogTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

export async function deleteWorklog(
  taskId: string,
  id: string,
  workspaceId: string,
) {
  const projectId = await db.transaction(async (tx) => {
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
    const [removed] = await tx
      .delete(taskWorklogTable)
      .where(
        and(eq(taskWorklogTable.id, id), eq(taskWorklogTable.taskId, taskId)),
      )
      .returning({ id: taskWorklogTable.id });
    if (!removed)
      throw new HTTPException(404, { message: "Time log not found" });
    return task.projectId;
  });
  await publishEvent("time-entry.total-updated", { taskId, projectId });
  return { id };
}
