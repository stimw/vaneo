import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { ReportBasis, ReportPeriod } from "./get-completed-report";

export type ReportFilters = {
  search: string;
  day?: string;
  zeroOnly: "true" | "false";
  sort: "completed" | "time";
};

export async function getCompletedReportPage(
  projectId: string,
  period: ReportPeriod,
  filters: ReportFilters,
  page: number,
  limit: number,
  signal?: AbortSignal,
  basis: ReportBasis = "completed",
) {
  if (basis === "logged") {
    const response = await client.task["work-report"][":projectId"].$get(
      {
        param: { projectId },
        query: {
          ...period,
          ...filters,
          page: String(page),
          limit: String(limit),
        },
      },
      { init: { signal } },
    );
    if (!response.ok) throw await HttpError.fromResponse(response);
    return response.json();
  }
  const response = await client.task["completed-report"][
    ":projectId"
  ].tasks.$get(
    {
      param: { projectId },
      query: {
        ...period,
        ...filters,
        page: String(page),
        limit: String(limit),
      },
    },
    { init: { signal } },
  );
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
