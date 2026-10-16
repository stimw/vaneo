import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type ReportPeriod = { from: string; to: string; timeZone: string };

export async function getCompletedReport(
  projectId: string,
  period: ReportPeriod,
  signal?: AbortSignal,
) {
  const response = await client.task["completed-report"][":projectId"].$get(
    {
      param: { projectId },
      query: period,
    },
    { init: { signal } },
  );
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
