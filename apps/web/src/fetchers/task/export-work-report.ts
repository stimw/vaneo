import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { ReportPeriod } from "./get-completed-report";
import type { ReportFilters } from "./get-completed-report-page";

export async function exportWorkReport(
  projectId: string,
  period: ReportPeriod,
  filters: ReportFilters,
) {
  const response = await client.task["work-export"][":projectId"].$get({
    param: { projectId },
    query: { ...period, ...filters },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
