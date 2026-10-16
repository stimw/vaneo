import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  getCompletedReportPage,
  type ReportFilters,
} from "@/fetchers/task/get-completed-report-page";
import type { ReportPeriod } from "@/fetchers/task/get-completed-report";

export function useCompletedReportTasks(
  projectId: string,
  period: ReportPeriod,
  filters: ReportFilters,
  limit: number,
) {
  const scope = JSON.stringify([projectId, period, filters, limit]);
  const [position, setPosition] = useState({ scope, page: 1 });
  // A changed filter/period starts at page one, including when revisiting cached results.
  if (position.scope !== scope) setPosition({ scope, page: 1 });
  const requestedPage = position.scope === scope ? position.page : 1;
  const query = useInfiniteQuery({
    queryKey: ["completed-reports", projectId, "tasks", period, filters, limit],
    queryFn: ({ pageParam, signal }) =>
      getCompletedReportPage(
        projectId,
        period,
        filters,
        pageParam,
        limit,
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const pages = query.data?.pages ?? [];
  const total = pages[0]?.summary.taskCount ?? 0;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / limit)));
  const current = pages.find((entry) => entry.page === page);
  const goToPage = async (next: number) => {
    if (query.isFetching || next < 1) return;
    if (pages.some((entry) => entry.page === next)) {
      setPosition({ scope, page: next });
      return;
    }
    if (next <= page) return;
    const result = await query.fetchNextPage({ cancelRefetch: false });
    // A failed request leaves the current page visible and available for retry.
    if (result.data?.pages.some((entry) => entry.page === next))
      setPosition({ scope, page: next });
  };
  return { ...query, current, page, goToPage };
}
