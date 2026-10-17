import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { seedDefaultWorkspaceRoles } from "../../apps/api/src/utils/seed-default-workspace-roles";
import { defaultRolePayloads } from "../../packages/permissions/src";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

function json(body: unknown, cookie = "") {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
      cookie,
    },
    body: JSON.stringify(body),
  };
}

describe("default workspace roles", () => {
  it("creates an editable Client role through the real workspace creation flow", async () => {
    const { app } = createApp();
    const signup = await app.request(
      "/api/auth/sign-up/email",
      json({
        email: "workspace-owner@example.test",
        name: "Workspace owner",
        password: "test-password-for-workspace-owner",
      }),
    );
    expect(signup.status).toBe(200);
    const cookie = signup.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const created = await app.request(
      "/api/auth/organization/create",
      json({ name: "Client workspace", slug: "client-workspace" }, cookie),
    );
    expect(created.status).toBe(200);
    const workspace = (await created.json()) as { id: string };
    const roles = await db.query.workspaceRoleTable.findMany({
      where: eq(schema.workspaceRoleTable.workspaceId, workspace.id),
    });
    expect(roles.map((role) => role.role).sort()).toEqual([
      "admin",
      "client",
      "member",
      "viewer",
    ]);
    const client = roles.find((role) => role.role === "client");
    expect(JSON.parse(client!.permission)).toEqual(defaultRolePayloads.client);

    const edited = await app.request(
      "/api/auth/organization/update-role",
      json(
        {
          organizationId: workspace.id,
          roleName: "client",
          data: { permission: { workspace: ["read"], task: ["read"] } },
        },
        cookie,
      ),
    );
    expect(edited.status).toBe(200);
    await seedDefaultWorkspaceRoles();
    const preserved = await db.query.workspaceRoleTable.findFirst({
      where: eq(schema.workspaceRoleTable.id, client!.id),
    });
    expect(JSON.parse(preserved!.permission)).toEqual({
      workspace: ["read"],
      task: ["read"],
    });
  });

  it("backfills missing Client roles once while preserving existing custom permissions", async () => {
    const missing = await createWorkspaceMember();
    const existing = await createWorkspaceMember();
    const permission = JSON.stringify({ workspace: ["read"], task: ["read"] });
    const [original] = await db
      .insert(schema.workspaceRoleTable)
      .values({
        workspaceId: existing.workspace.id,
        role: "client",
        permission,
      })
      .returning();
    await seedDefaultWorkspaceRoles();
    await seedDefaultWorkspaceRoles();
    const roles = await db.select().from(schema.workspaceRoleTable);
    expect(roles).toHaveLength(8);
    const added = roles.find(
      (role) =>
        role.workspaceId === missing.workspace.id && role.role === "client",
    );
    expect(JSON.parse(added!.permission)).toEqual(defaultRolePayloads.client);
    expect(roles.find((role) => role.id === original.id)).toEqual(original);
  });

  it("allows default Client task collaboration but denies time writes and foreign workspace access", async () => {
    const client = await createWorkspaceMember({ role: "client" });
    const foreign = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: client.workspace.id,
    });
    const { project: foreignProject } = await createProjectFixture({
      workspaceId: foreign.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        number: 1,
        title: "Client task",
        status: "to-do",
      })
      .returning();
    await seedDefaultWorkspaceRoles();
    mockAuthenticatedSession(client.user);
    const { app } = createApp();
    const capabilities = await app.request(
      `/api/workspace/${client.workspace.id}/capabilities`,
    );
    expect(capabilities.status).toBe(200);
    expect(await capabilities.json()).toMatchObject({
      createProjects: false,
      manageWorkspace: false,
      inviteUsers: false,
      createTasks: true,
      updateTasks: true,
      deleteTasks: false,
      createTimeEntries: false,
      updateTimeEntries: false,
    });
    expect((await app.request(`/api/project/${project.id}`)).status).toBe(200);
    expect((await app.request(`/api/time-entry/task/${task.id}`)).status).toBe(
      200,
    );
    const timeWrite = await app.request(
      "/api/time-entry",
      json({
        taskId: task.id,
        startTime: "2026-10-01T09:00:00Z",
        endTime: "2026-10-01T10:00:00Z",
      }),
    );
    expect(timeWrite.status).toBe(403);
    expect(
      (await app.request(`/api/project/${foreignProject.id}`)).status,
    ).toBe(404);
  });
});
