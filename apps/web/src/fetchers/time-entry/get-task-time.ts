import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
export default async function getTaskTime(taskId: string) {
  const response = await client["time-entry"].task[":taskId"].total.$get({
    param: { taskId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
