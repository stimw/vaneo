import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
export default async function setTaskTime({
  taskId,
  totalSeconds,
}: {
  taskId: string;
  totalSeconds: number;
}) {
  const response = await client["time-entry"].task[":taskId"].total.$put({
    param: { taskId },
    json: { totalSeconds },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
