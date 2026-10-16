import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { ReportFilters } from "./get-completed-report-page";

export async function exportCompletedTasks(
  projectId: string,
  period: { from: string; to: string; timeZone: string },
  filters?: ReportFilters,
) {
  const response = await client.task["completed-export"][":projectId"].$get({
    param: { projectId },
    query: { ...period, ...filters },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
