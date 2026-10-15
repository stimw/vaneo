import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";

export default async function getTaskTime(taskId: string) {
  const [task] = await db
    .select({ taskId: taskTable.id, totalSeconds: taskTable.trackedSeconds })
    .from(taskTable)
    .where(eq(taskTable.id, taskId));
  if (!task) throw new HTTPException(404, { message: "Task not found" });
  return task;
}
