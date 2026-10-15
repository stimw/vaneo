import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

export default async function setTaskTime(
  taskId: string,
  totalSeconds: number,
) {
  const [task] = await db
    .update(taskTable)
    .set({ trackedSeconds: totalSeconds })
    .where(eq(taskTable.id, taskId))
    .returning({
      taskId: taskTable.id,
      projectId: taskTable.projectId,
      totalSeconds: taskTable.trackedSeconds,
    });
  if (!task) throw new HTTPException(404, { message: "Task not found" });
  await publishEvent("time-entry.total-updated", {
    taskId,
    projectId: task.projectId,
  });
  return { taskId, totalSeconds: task.totalSeconds };
}
