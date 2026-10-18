import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { createInvitationWorkspace } from "./helpers/project-access/create-invitation-workspace";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

beforeEach(resetTestDatabase);

describe("workspace invitation roles", () => {
  it("returns only role names from the inviter's workspace without requiring ac:read", async () => {
    const inviter = await createWorkspaceMember({ role: "inviter" });
    const foreign = await createWorkspaceMember();
    await db.insert(schema.workspaceRoleTable).values([
      {
        workspaceId: inviter.workspace.id,
        role: "inviter",
        permission: JSON.stringify({
          workspace: ["read"],
          invitation: ["create"],
        }),
      },
      { workspaceId: inviter.workspace.id, role: "reviewer", permission: "{}" },
      { workspaceId: inviter.workspace.id, role: "owner", permission: "{}" },
      {
        workspaceId: foreign.workspace.id,
        role: "foreign-role",
        permission: "{}",
      },
    ]);
    mockAuthenticatedSession(inviter.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/workspace/${inviter.workspace.id}/invitation-roles`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      "viewer",
      "client",
      "member",
      "admin",
      "inviter",
      "reviewer",
    ]);
    expect(
      (
        await app.request(
          `/api/workspace/${foreign.workspace.id}/invitation-roles`,
        )
      ).status,
    ).toBe(404);
  });

  it("denies role enumeration to a Client without invitation permission and to anonymous callers", async () => {
    const client = await createWorkspaceMember({ role: "client" });
    mockAuthenticatedSession(client.user);
    const { app } = createApp();
    const path = `/api/workspace/${client.workspace.id}/invitation-roles`;
    expect((await app.request(path)).status).toBe(403);
    mockAnonymousSession();
    expect((await app.request(path)).status).toBe(401);
  });

  it.each(["client", "reviewer"])(
    "preserves the invited %s role and selected-project access when the user accepts",
    async (role) => {
      const ctx = await createInvitationWorkspace();
      await db.insert(schema.workspaceRoleTable).values({
        workspaceId: ctx.workspaceId,
        role: "reviewer",
        permission: JSON.stringify({
          workspace: ["read"],
          project: ["read"],
          task: ["read"],
        }),
      });
      const email = `${role}@example.test`;
      const invitation = await ctx.ownerRequest(
        "/auth/organization/invite-member",
        {
          method: "POST",
          body: {
            organizationId: ctx.workspaceId,
            email,
            role,
            projectAccess: "selected",
            projectIds: [ctx.alpha.id],
          },
        },
      );
      expect(invitation.status).toBe(200);
      const pending = await invitation.json();
      expect(pending.role).toBe(role);
      const invitee = await signUpWithSession(ctx.app, {
        email,
        name: "Invited account",
        role: "user",
      });
      const request = projectAccessApi({ cookie: invitee.cookies });
      const accepted = await request("/auth/organization/accept-invitation", {
        method: "POST",
        body: { invitationId: pending.id },
      });
      expect(accepted.status).toBe(200);
      const member = await db.query.workspaceUserTable.findFirst({
        where: and(
          eq(schema.workspaceUserTable.workspaceId, ctx.workspaceId),
          eq(schema.workspaceUserTable.userId, invitee.userId),
        ),
      });
      expect(member?.role).toBe(role);
      expect((await request(`/project/${ctx.alpha.id}`)).status).toBe(200);
      expect((await request(`/project/${ctx.beta.id}`)).status).toBe(403);
      const capabilities = await request(
        `/workspace/${ctx.workspaceId}/capabilities`,
      );
      expect(await capabilities.json()).toMatchObject({
        createTimeEntries: false,
        updateTimeEntries: false,
        createProjects: false,
      });
    },
  );

  it("rejects roles that only exist in another workspace", async () => {
    const ctx = await createInvitationWorkspace();
    const foreign = await createWorkspaceMember();
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: foreign.workspace.id,
      role: "foreign-role",
      permission: "{}",
    });
    const response = await ctx.ownerRequest(
      "/auth/organization/invite-member",
      {
        method: "POST",
        body: {
          organizationId: ctx.workspaceId,
          email: "invitee@example.test",
          role: "foreign-role",
        },
      },
    );
    expect(response.status).toBe(400);
    expect(await db.select().from(schema.invitationTable)).toHaveLength(0);
  });
});
