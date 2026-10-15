import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable, timeEntryTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { resolveDuration } from "../duration";

type UpdateTimeEntryParams = {
  timeEntryId: string;
  startTime: Date;
  endTime?: Date;
  description?: string;
};

async function updateTimeEntry(params: UpdateTimeEntryParams) {
  const { timeEntryId, startTime, endTime, description } = params;

  const [existingTimeEntry] = await db
    .select()
    .from(timeEntryTable)
    .where(eq(timeEntryTable.id, timeEntryId));

  if (!existingTimeEntry) {
    throw new HTTPException(404, {
      message: "Time entry not found",
    });
  }

  const effectiveEndTime = endTime ?? existingTimeEntry.endTime;

  const duration = resolveDuration(startTime, effectiveEndTime ?? undefined);

  const [updatedTimeEntry] = await db
    .update(timeEntryTable)
    .set({
      startTime,
      endTime: effectiveEndTime,
      duration,
      ...(description !== undefined && { description }),
    })
    .where(eq(timeEntryTable.id, timeEntryId))
    .returning();

  if (!updatedTimeEntry)
    throw new HTTPException(404, { message: "Time entry not found" });
  const task = await db.query.taskTable.findFirst({
    columns: { projectId: true },
    where: eq(taskTable.id, updatedTimeEntry.taskId),
  });
  if (task)
    await publishEvent("time-entry.updated", {
      taskId: updatedTimeEntry.taskId,
      projectId: task.projectId,
      timeEntryId: updatedTimeEntry.id,
    });
  return updatedTimeEntry;
}

export default updateTimeEntry;
