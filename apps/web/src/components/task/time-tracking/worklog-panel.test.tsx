import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { WorklogPanel } from "./worklog-panel";

const { getWorklogs, saveWorklog, permission } = vi.hoisted(() => ({
  getWorklogs: vi.fn(),
  saveWorklog: vi.fn(),
  permission: { edit: true },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/fetchers/time-entry/worklogs", () => ({
  getWorklogs,
  saveWorklog,
  deleteWorklog: vi.fn(),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTimeEntries: () => permission.edit,
    canUpdateTimeEntries: () => permission.edit,
  }),
}));
vi.mock("@/hooks/mutations/time-entry/use-invalidate-task-effort", () => ({
  useInvalidateTaskEffort: () => vi.fn(),
}));

beforeEach(() => {
  permission.edit = true;
  getWorklogs.mockResolvedValue({
    entries: [
      {
        id: "log",
        workDate: "2026-10-14",
        duration: 900,
        userName: "Developer",
      },
    ],
    total: 1,
    totalSeconds: 4500,
    unallocatedSeconds: 3600,
    nextPage: null,
  });
  saveWorklog.mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPanel() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorklogPanel taskId="task" />
    </QueryClientProvider>,
  );
}

describe("dated task time editing", () => {
  it("edits a dated log while retaining a read-only historical balance and no total adjustment action", async () => {
    renderPanel();
    expect(await screen.findByText("Oct 14, 2026")).toBeVisible();
    expect(screen.getByText("tasks:worklog.undated")).toBeVisible();
    expect(screen.getByText("1h")).toBeVisible();
    expect(screen.queryByRole("button", { name: /adjust/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "tasks:worklog.edit" }));
    const hours = screen.getByRole("spinbutton", { name: "tasks:time.hours" });
    expect(hours).toHaveValue(0.25);
    fireEvent.change(hours, { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("button", { name: "tasks:worklog.save" }));
    await waitFor(() =>
      expect(saveWorklog).toHaveBeenCalledWith("task", {
        id: "log",
        workDate: "2026-10-14",
        duration: 1800,
      }),
    );
    expect(screen.queryByRole("button", { name: /adjust/i })).toBeNull();
  });

  it("lets clients view dated time and historical balances without edit or total-adjustment controls", async () => {
    permission.edit = false;
    renderPanel();
    expect(await screen.findByText("Oct 14, 2026")).toBeVisible();
    expect(screen.getByText("15m")).toBeVisible();
    expect(screen.getByText("tasks:worklog.undated")).toBeVisible();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
