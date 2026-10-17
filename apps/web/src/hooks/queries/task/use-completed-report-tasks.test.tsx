import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  getCompletedReportPage,
  type ReportFilters,
} from "@/fetchers/task/get-completed-report-page";
import { useCompletedReportTasks } from "./use-completed-report-tasks";

vi.mock("@/fetchers/task/get-completed-report-page", () => ({
  getCompletedReportPage: vi.fn(),
}));
const fetchPage = vi.mocked(getCompletedReportPage);
const period = {
  from: "2026-10-01T00:00:00Z",
  to: "2026-11-01T00:00:00Z",
  timeZone: "UTC",
};
const filters: ReportFilters = {
  search: "",
  zeroOnly: "false",
  sort: "completed",
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

function pageResult(page: number, total = 18) {
  return {
    page,
    limit: 10,
    nextPage: page * 10 < total ? page + 1 : null,
    tasks: [],
    summary: { taskCount: total, totalSeconds: 10800, zeroCount: 2 },
  };
}

afterEach(() => vi.resetAllMocks());

describe("report table pagination", () => {
  it("loads only requested pages, reuses previous pages and resets paging for filters and page size", async () => {
    const { client, wrapper } = setup();
    fetchPage.mockImplementation(async (_id, _period, _filters, page) =>
      pageResult(page),
    );
    const { result, rerender, unmount } = renderHook(
      ({ query, limit }) =>
        useCompletedReportTasks("project", period, query, limit),
      {
        wrapper,
        initialProps: { query: filters, limit: 10 },
      },
    );
    await waitFor(() => expect(result.current.current?.page).toBe(1));
    expect(fetchPage).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.goToPage(2);
    });
    await waitFor(() => expect(result.current.current?.page).toBe(2));
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.current.current?.summary.totalSeconds).toBe(10800);
    await act(async () => {
      await result.current.goToPage(1);
    });
    expect(result.current.page).toBe(1);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    await act(async () => {
      await result.current.goToPage(2);
    });
    expect(fetchPage).toHaveBeenCalledTimes(2);
    rerender({ query: { ...filters, search: "password" }, limit: 10 });
    await waitFor(() => expect(result.current.current?.page).toBe(1));
    expect(fetchPage.mock.lastCall?.[2].search).toBe("password");
    rerender({ query: filters, limit: 10 });
    await waitFor(() => expect(result.current.current?.page).toBe(1));
    rerender({ query: filters, limit: 25 });
    await waitFor(() => expect(fetchPage.mock.lastCall?.[4]).toBe(25));
    expect(result.current.page).toBe(1);
    unmount();
    client.clear();
  });

  it("retains the current page when loading the next page fails, and allows retry", async () => {
    const { client, wrapper } = setup();
    fetchPage
      .mockResolvedValueOnce(pageResult(1))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(pageResult(2));
    const { result, unmount } = renderHook(
      () => useCompletedReportTasks("project", period, filters, 10),
      { wrapper },
    );
    await waitFor(() => expect(result.current.current?.page).toBe(1));
    await act(async () => {
      await result.current.goToPage(2);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.current?.page).toBe(1);
    await act(async () => {
      await result.current.goToPage(2);
    });
    await waitFor(() => expect(result.current.current?.page).toBe(2));
    expect(result.current.isError).toBe(false);
    unmount();
    client.clear();
  });
});

it("separates logged/completed caches and resets pagination when the report basis changes", async () => {
  const { client, wrapper } = setup();
  fetchPage.mockImplementation(async (_id, _period, _filters, page) =>
    pageResult(page),
  );
  const { result, rerender, unmount } = renderHook(
    ({ basis }: { basis: "logged" | "completed" }) =>
      useCompletedReportTasks("project", period, filters, 10, basis),
    { wrapper, initialProps: { basis: "completed" as "logged" | "completed" } },
  );
  await waitFor(() => expect(result.current.current?.page).toBe(1));
  await act(async () => {
    await result.current.goToPage(2);
  });
  expect(result.current.page).toBe(2);
  rerender({ basis: "logged" });
  await waitFor(() => expect(result.current.current?.page).toBe(1));
  expect(fetchPage.mock.lastCall?.[6]).toBe("logged");
  expect(result.current.page).toBe(1);
  unmount();
  client.clear();
});
