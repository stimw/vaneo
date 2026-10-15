import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { TimeTotalForm } from "./time-total-form";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/time-entry/use-set-task-time", () => ({
  useSetTaskTime: () => ({ mutateAsync: save, isPending: false }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("offers one duration field and saves an absolute total rather than adding another entry", async () => {
  save.mockResolvedValue({ totalSeconds: 10800 });
  const saved = vi.fn();
  render(<TimeTotalForm taskId="task" totalSeconds={7200} onSaved={saved} />);
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getAllByRole("button")).toHaveLength(1);
  const field = screen.getByRole("spinbutton", { name: "tasks:time.hours" });
  expect(field).toHaveValue(2);
  fireEvent.change(field, { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "tasks:time.save" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(save).toHaveBeenCalledWith(10800);
});

it("can clear the total and keeps a failed save editable", async () => {
  save.mockRejectedValue(new Error("Permission changed"));
  const saved = vi.fn();
  render(<TimeTotalForm taskId="task" totalSeconds={7200} onSaved={saved} />);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "tasks:time.save" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("Permission changed"),
  );
  expect(save).toHaveBeenCalledWith(0);
  expect(screen.getByRole("spinbutton")).toHaveValue(0);
  expect(saved).not.toHaveBeenCalled();
});
