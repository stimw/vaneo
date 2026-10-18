import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import useInviteWorkspaceUser from "@/hooks/mutations/workspace-user/use-invite-workspace-user";
import { toast } from "@/lib/toast";
import queryClient from "@/query-client";
import InviteTeamMemberModal from "./invite-team-member-modal";

const { inviteMember } = vi.hoisted(() => ({ inviteMember: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { inviteMember } },
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string) =>
      key === "settings:invitationEmailFailed"
        ? "The invitation email could not be sent."
        : key,
  }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace" } }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canInviteUsers: () => true }),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({
    data: [
      { id: "project-a", name: "Alpha" },
      { id: "project-b", name: "Beta" },
    ],
    isLoading: false,
  }),
}));
const myAccess = vi.fn(() => ({
  isPending: false,
  isError: false,
  data: { projectAccess: "all", projectIds: [] as string[] },
}));
const roleQuery = vi.fn(
  (): {
    data: string[] | undefined;
    isPending: boolean;
    isError: boolean;
    refetch: ReturnType<typeof vi.fn>;
  } => ({
    data: ["viewer", "client", "member", "admin", "reviewer"],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
);
vi.mock("@/hooks/queries/workspace/use-invitation-roles", () => ({
  useInvitationRoles: () => roleQuery(),
}));
vi.mock("@/hooks/queries/workspace-users/use-get-my-project-access", () => ({
  default: () => myAccess(),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./invitation-link-field", () => ({ default: () => null }));
function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  roleQuery.mockReturnValue({
    data: ["viewer", "client", "member", "admin", "reviewer"],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  });
  inviteMember.mockResolvedValue({
    data: null,
    error: { code: "INVITATION_EMAIL_FAILED", message: "Upstream failure" },
  });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});
describe("invitation email delivery errors", () => {
  it.each([false, true])(
    "rejects with a translated error when resend is %s",
    async (resend) => {
      const { result } = renderHook(useInviteWorkspaceUser, { wrapper });
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      await act(async () => {
        await expect(
          result.current.mutateAsync({
            workspaceId: "workspace",
            email: "member@example.com",
            role: "member",
            resend,
          }),
        ).rejects.toThrow("The invitation email could not be sent.");
      });
      expect(inviteMember).toHaveBeenCalledWith({
        organizationId: "workspace",
        email: "member@example.com",
        role: "member",
        resend,
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["workspace-invites", "workspace"],
      });
    },
  );
  it("shows an error instead of a success notification in the invite modal", async () => {
    const onClose = vi.fn();
    render(<InviteTeamMemberModal open onClose={onClose} />, { wrapper });
    fireEvent.change(
      await screen.findByPlaceholderText("team:inviteModal.emailPlaceholder"),
      {
        target: { value: "member@example.com" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "team:inviteModal.sendInvitation" }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "The invitation email could not be sent.",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("invitation project access", () => {
  beforeEach(() => {
    inviteMember.mockResolvedValue({ data: { id: "invite-1" }, error: null });
  });

  async function fillEmail() {
    fireEvent.change(
      await screen.findByPlaceholderText("team:inviteModal.emailPlaceholder"),
      { target: { value: "member@example.com" } },
    );
  }

  function submit() {
    fireEvent.click(
      screen.getByRole("button", { name: "team:inviteModal.sendInvitation" }),
    );
  }

  it("invites with access to every project by default", async () => {
    render(<InviteTeamMemberModal open onClose={vi.fn()} />, { wrapper });
    await fillEmail();
    submit();
    await waitFor(() =>
      expect(inviteMember).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "member",
          projectAccess: "all",
          projectIds: [],
        }),
      ),
    );
  });

  it("starts a limited inviter on selected projects", async () => {
    myAccess.mockReturnValue({
      isPending: false,
      isError: false,
      data: { projectAccess: "selected", projectIds: ["project-a"] },
    });
    render(<InviteTeamMemberModal open onClose={vi.fn()} />, { wrapper });
    await fillEmail();

    expect(
      screen.getByRole("radio", { name: /team:projectAccess.allProjects/ }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("radio", {
        name: /team:projectAccess.selectedProjects/,
      }),
    ).toHaveAttribute("aria-checked", "true");
    myAccess.mockReturnValue({
      isPending: false,
      isError: false,
      data: { projectAccess: "all", projectIds: [] },
    });
  });

  it("waits for the inviter's own access before sending", async () => {
    myAccess.mockReturnValue({
      isPending: true,
      isError: false,
      data: undefined as unknown as {
        projectAccess: string;
        projectIds: string[];
      },
    });
    render(<InviteTeamMemberModal open onClose={vi.fn()} />, { wrapper });
    await fillEmail();

    expect(
      screen.getByRole("button", { name: "team:inviteModal.sendInvitation" }),
    ).toBeDisabled();
    myAccess.mockReturnValue({
      isPending: false,
      isError: false,
      data: { projectAccess: "all", projectIds: [] },
    });
  });

  it("requires a project before inviting with selected access", async () => {
    render(<InviteTeamMemberModal open onClose={vi.fn()} />, { wrapper });
    await fillEmail();
    fireEvent.click(
      screen.getByRole("radio", {
        name: /team:projectAccess.selectedProjects/,
      }),
    );
    submit();
    expect(
      await screen.findByText("team:projectAccess.selectAtLeastOne"),
    ).toBeVisible();
    expect(inviteMember).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Beta" }));
    submit();
    await waitFor(() =>
      expect(inviteMember).toHaveBeenCalledWith(
        expect.objectContaining({
          projectAccess: "selected",
          projectIds: ["project-b"],
        }),
      ),
    );
  });
});

describe("invitation role selection", () => {
  beforeEach(() => {
    inviteMember.mockResolvedValue({ data: { id: "invite-1" }, error: null });
  });

  async function selectRole(role: string) {
    fireEvent.click(
      await screen.findByRole("combobox", {
        name: "team:inviteModal.roleLabel",
      }),
    );
    const option = await screen.findByRole("option", { name: role });
    fireEvent.pointerDown(option);
    fireEvent.mouseDown(option);
    fireEvent.mouseUp(option);
    fireEvent.click(option);
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "team:inviteModal.roleLabel" }),
      ).toHaveTextContent(role),
    );
  }

  function fillAndSubmit() {
    fireEvent.change(
      screen.getByPlaceholderText("team:inviteModal.emailPlaceholder"),
      {
        target: { value: "client@example.com" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "team:inviteModal.sendInvitation" }),
    );
  }

  it.each([
    ["team:roles.client", "client"],
    ["reviewer", "reviewer"],
  ])("sends the chosen %s role with project access", async (label, role) => {
    render(<InviteTeamMemberModal open onClose={vi.fn()} />, { wrapper });
    await selectRole(label);
    fillAndSubmit();
    await waitFor(() =>
      expect(inviteMember).toHaveBeenCalledWith(
        expect.objectContaining({
          role,
          organizationId: "workspace",
          projectAccess: "all",
          projectIds: [],
        }),
      ),
    );
  });

  it("offers the workspace roles without offering owner", async () => {
    render(<InviteTeamMemberModal open onClose={vi.fn()} />, { wrapper });
    fireEvent.click(
      await screen.findByRole("combobox", {
        name: "team:inviteModal.roleLabel",
      }),
    );
    expect(
      await screen.findByRole("option", { name: "team:roles.client" }),
    ).toBeVisible();
    expect(screen.getByRole("option", { name: "reviewer" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "team:roles.owner" }),
    ).not.toBeInTheDocument();
  });

  it("waits for roles instead of silently sending a member invitation", async () => {
    roleQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(<InviteTeamMemberModal open onClose={vi.fn()} />, { wrapper });
    expect(
      await screen.findByRole("button", {
        name: "team:inviteModal.sendInvitation",
      }),
    ).toBeDisabled();
    fireEvent.submit(
      screen
        .getByPlaceholderText("team:inviteModal.emailPlaceholder")
        .closest("form")!,
    );
    await waitFor(() =>
      expect(
        screen.getByText("team:inviteModal.chooseAvailableRole"),
      ).toBeVisible(),
    );
    expect(inviteMember).not.toHaveBeenCalled();
  });

  it("shows an actionable error when roles cannot be loaded", async () => {
    const refetch = vi.fn();
    roleQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    render(<InviteTeamMemberModal open onClose={vi.fn()} />, { wrapper });
    expect(
      await screen.findByText("team:inviteModal.rolesLoadError"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "team:inviteModal.sendInvitation" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "team:inviteModal.retryRoles" }),
    );
    expect(refetch).toHaveBeenCalledOnce();
    expect(inviteMember).not.toHaveBeenCalled();
  });

  it("refuses a role that disappears while the invitation is being edited", async () => {
    const view = render(<InviteTeamMemberModal open onClose={vi.fn()} />, {
      wrapper,
    });
    await selectRole("team:roles.client");
    roleQuery.mockReturnValue({
      data: ["member"],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    view.rerender(<InviteTeamMemberModal open onClose={vi.fn()} />);
    expect(
      screen.getByRole("combobox", { name: "team:inviteModal.roleLabel" }),
    ).toHaveTextContent("team:roles.client");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "team:inviteModal.sendInvitation" }),
      ).toBeDisabled(),
    );
    expect(inviteMember).not.toHaveBeenCalled();
    await selectRole("team:roles.member");
    fillAndSubmit();
    await waitFor(() =>
      expect(inviteMember).toHaveBeenCalledWith(
        expect.objectContaining({ role: "member" }),
      ),
    );
  });
});
