import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type ReportBasis = "logged" | "completed";
export type ReportCategoryFilter = {
  categoryFieldId?: string;
  category?: string;
};

export type ReportPeriod = { from: string; to: string; timeZone: string };

export async function getCompletedReport(
  projectId: string,
  period: ReportPeriod,
  signal?: AbortSignal,
  basis: ReportBasis = "completed",
  category: ReportCategoryFilter = {},
) {
  if (basis === "logged") {
    const response = await client.task["work-report"][":projectId"].$get(
      {
        param: { projectId },
        query: { ...period, ...category, page: "1", limit: "1" },
      },
      { init: { signal } },
    );
    if (!response.ok) throw await HttpError.fromResponse(response);
    return response.json();
  }
  const response = await client.task["completed-report"][":projectId"].$get(
    {
      param: { projectId },
      query: { ...period, ...category },
    },
    { init: { signal } },
  );
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
