import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { UploadSettingsPanel } from "./upload-settings-panel";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  refetch: vi.fn(),
  config: { maxUploadBytes: 10 * 1024 * 1024 },
  error: false,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({
    data: mocks.config,
    isPending: false,
    isError: mocks.error,
    refetch: mocks.refetch,
  }),
}));
vi.mock("@/hooks/mutations/admin/use-update-upload-settings", () => ({
  useUpdateUploadSettings: () => ({
    mutateAsync: mocks.save,
    isPending: false,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config = { maxUploadBytes: 10 * 1024 * 1024 };
  mocks.error = false;
});
afterEach(cleanup);

it("labels the per-file limit and only saves a valid changed value in bytes", async () => {
  mocks.save.mockImplementation(async (bytes: number) => {
    mocks.config = { maxUploadBytes: bytes };
  });
  render(<UploadSettingsPanel />);
  const input = screen.getByRole("spinbutton", {
    name: "settings:adminUploads.maxFileSize",
  });
  const save = screen.getByRole("button", {
    name: "settings:adminUploads.save",
  });
  expect(input).toHaveValue(10);
  expect(save).toBeDisabled();
  fireEvent.change(input, { target: { value: "25" } });
  fireEvent.click(save);
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(25 * 1024 * 1024),
  );
  await waitFor(() => expect(save).toBeDisabled());
  expect(input).toHaveValue(25);
});

it.each(["", "0", "1.5", "1025"])(
  "does not submit an invalid limit %s",
  (value) => {
    render(<UploadSettingsPanel />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value } });
    expect(
      screen.getByRole("button", { name: "settings:adminUploads.save" }),
    ).toBeDisabled();
    expect(
      screen.getByText("settings:adminUploads.invalidLimit"),
    ).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  },
);

it("keeps an unsaved limit available after a failed save", async () => {
  mocks.save.mockRejectedValueOnce(new Error("Network unavailable"));
  render(<UploadSettingsPanel />);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "25" } });
  fireEvent.click(
    screen.getByRole("button", { name: "settings:adminUploads.save" }),
  );
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(screen.getByRole("spinbutton")).toHaveValue(25);
});

it("offers a retry when settings could not be loaded", () => {
  mocks.error = true;
  render(<UploadSettingsPanel />);
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "settings:adminUploads.retry" }),
  );
  expect(mocks.refetch).toHaveBeenCalledOnce();
});
