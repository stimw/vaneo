import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TaskEffort } from "./task-effort";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(cleanup);
describe("task effort display", () => {
  it("shows actual completion independently of the hours budget", () => {
    render(
      <TaskEffort
        progress={45}
        trackedSeconds={32 * 3600}
        estimatedSeconds={80 * 3600}
      />,
    );
    expect(screen.getByText("45%")).toBeTruthy();
    expect(screen.getByText("32h / 80h")).toBeTruthy();
    expect(screen.queryByText("40%")).toBeNull();
  });
  it("marks an overrun without treating it as 100% completion", () => {
    render(
      <TaskEffort
        progress={70}
        trackedSeconds={28 * 3600}
        estimatedSeconds={24 * 3600}
      />,
    );
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("28h / 24h").className).toContain(
      "text-orange-600",
    );
    expect(screen.queryByText("100%")).toBeNull();
  });
  it("shows completed tasks as 100%, and keeps missing estimates/progress explicit", () => {
    const { rerender } = render(
      <TaskEffort progress={45} trackedSeconds={0} completed />,
    );
    expect(screen.getByText("100%")).toBeTruthy();
    rerender(<TaskEffort trackedSeconds={9000} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("2h 30m")).toBeTruthy();
  });
});
