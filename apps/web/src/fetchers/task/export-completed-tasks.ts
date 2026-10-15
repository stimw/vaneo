import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function exportCompletedTasks(
  projectId: string,
  period: { from: string; to: string; timeZone: string },
) {
  const response = await client.task["completed-export"][":projectId"].$get({
    param: { projectId },
    query: period,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
