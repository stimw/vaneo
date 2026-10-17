import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

export async function updateTaskPlanning(
  taskId: string,
  workspaceId: string,
  values: {
    estimatedSeconds?: number | null;
    progress?: number | null;
  },
) {
  const [task] = await db
    .update(taskTable)
    .set(values)
    .where(
      and(
        eq(taskTable.id, taskId),
        inArray(
          taskTable.projectId,
          db
            .select({ id: projectTable.id })
            .from(projectTable)
            .where(eq(projectTable.workspaceId, workspaceId)),
        ),
      ),
    )
    .returning({
      id: taskTable.id,
      projectId: taskTable.projectId,
      estimatedSeconds: taskTable.estimatedSeconds,
      progress: taskTable.progress,
    });
  if (!task) throw new HTTPException(404, { message: "Task not found" });
  await publishEvent("task.updated", {
    taskId: task.id,
    projectId: task.projectId,
  });
  return task;
}
