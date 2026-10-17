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
import { TaskProgressPopover } from "./task-progress-popover";

const { save, permission, invalidate } = vi.hoisted(() => ({
  save: vi.fn(),
  permission: { canUpdate: true },
  invalidate: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/fetchers/task/update-task-planning", () => ({
  updateTaskPlanning: save,
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTimeEntries: () => permission.canUpdate,
  }),
}));
vi.mock("@/hooks/mutations/time-entry/use-invalidate-task-effort", () => ({
  useInvalidateTaskEffort: () => invalidate,
}));

beforeEach(() => {
  permission.canUpdate = true;
  save.mockResolvedValue({ progress: 46 });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 320, 32),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function renderProgress(completed = false) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TaskProgressPopover
        task={{ id: "task", progress: 45 }}
        completed={completed}
      />
    </QueryClientProvider>,
  );
}

describe("manual task progress", () => {
  it("keeps the slider and percentage input in sync, saving only when confirmed", async () => {
    renderProgress();
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:planning.progress" }),
    );
    const slider = await screen.findByRole("slider", {
      name: "tasks:planning.progress",
    });
    const input = screen.getByRole("spinbutton", {
      name: "tasks:planning.progress",
    });
    expect(slider).toHaveAttribute("aria-valuenow", "45");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(input).toHaveValue(46);
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "70" } });
    expect(slider).toHaveAttribute("aria-valuenow", "70");
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:planning.save" }),
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("task", { progress: 70 }),
    );
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("does not save cancelled edits and keeps a failed save editable", async () => {
    renderProgress();
    const trigger = screen.getByRole("button", {
      name: "tasks:planning.progress",
    });
    fireEvent.click(trigger);
    const input = await screen.findByRole("spinbutton");
    fireEvent.change(input, { target: { value: "80" } });
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("spinbutton")).toBeNull());
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    const reopened = await screen.findByRole("spinbutton");
    expect(reopened).toHaveValue(45);
    save.mockRejectedValueOnce(new Error("Failed"));
    fireEvent.change(reopened, { target: { value: "90" } });
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:planning.save" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "tasks:time.saveError",
    );
    expect(reopened).toHaveValue(90);
  });

  it("keeps client and completed task progress read-only", () => {
    permission.canUpdate = false;
    const view = renderProgress();
    expect(
      screen.getByRole("button", { name: "tasks:planning.progress" }),
    ).toBeDisabled();
    view.unmount();
    permission.canUpdate = true;
    renderProgress(true);
    expect(
      screen.getByRole("button", { name: "tasks:planning.progress" }),
    ).toBeDisabled();
    expect(screen.getByText("100%")).toBeVisible();
  });
});
