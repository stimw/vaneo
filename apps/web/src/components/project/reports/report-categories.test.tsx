import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ReportCategories } from "./report-categories";
import type { ReportSummary } from "./report-values";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key} ${Object.values(values ?? {}).join(" ")}`.trim(),
    i18n: { language: "en-US" },
  }),
}));
afterEach(cleanup);
const fields = [
  {
    id: "business",
    name: "Business category",
    options: ["Marketing", "Sales"],
  },
];
const report = {
  categories: [
    { category: "Marketing", taskCount: 2, totalSeconds: 7200 },
    { category: null, taskCount: 1, totalSeconds: 900 },
  ],
} as ReportSummary;

describe("report categories", () => {
  it("selects exactly one category from aggregate cards and keeps unclassified work selectable", () => {
    const onChange = vi.fn();
    render(
      <ReportCategories
        fields={fields}
        fieldId="business"
        report={report}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Marketing/ }));
    expect(onChange).toHaveBeenLastCalledWith("business", "Marketing");
    fireEvent.click(screen.getByRole("button", { name: /uncategorized/ }));
    expect(onChange).toHaveBeenLastCalledWith("business", "");
  });

  it("can clear the category filter without disabling grouping", async () => {
    const onChange = vi.fn();
    render(
      <ReportCategories
        fields={fields}
        fieldId="business"
        category="Sales"
        report={report}
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:reports.clearCategory" }),
    );
    expect(onChange).toHaveBeenLastCalledWith("business", undefined);
  });

  it("changing the grouping field clears the prior category", async () => {
    const onChange = vi.fn();
    render(
      <ReportCategories
        fields={[...fields, { id: "team", name: "Team", options: ["A"] }]}
        fieldId="business"
        category="Sales"
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: "tasks:reports.groupBy" }),
    );
    const option = await screen.findByRole("option", { name: "Team" });
    fireEvent.pointerDown(option);
    fireEvent.mouseDown(option);
    fireEvent.pointerUp(option);
    fireEvent.mouseUp(option);
    fireEvent.click(option, { detail: 1 });
    expect(onChange).toHaveBeenLastCalledWith("team");
  });
});

it("retains the whole-period comparison when selected, and toggles the selection off", () => {
  const onChange = vi.fn();
  render(
    <ReportCategories
      fields={fields}
      fieldId="business"
      category="Marketing"
      report={report}
      onChange={onChange}
    />,
  );
  const row = screen.getByRole("button", { name: /categoryRow Marketing/ });
  expect(row).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("button", {
      name: /categoryRow tasks:reports.uncategorized/,
    }),
  ).toBeInTheDocument();
  fireEvent.click(row);
  expect(onChange).toHaveBeenLastCalledWith("business", undefined);
});

it("shows a retry state instead of a misleading empty chart on error", () => {
  const retry = vi.fn();
  render(
    <ReportCategories
      fields={fields}
      fieldId="business"
      error
      onRetry={retry}
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "tasks:reports.retry" }));
  expect(retry).toHaveBeenCalledOnce();
});
