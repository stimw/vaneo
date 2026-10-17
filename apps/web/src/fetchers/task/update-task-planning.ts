import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function updateTaskPlanning(
  taskId: string,
  values: { progress: number | null },
) {
  const response = await client.task[":id"].planning.$patch({
    param: { id: taskId },
    json: values,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
