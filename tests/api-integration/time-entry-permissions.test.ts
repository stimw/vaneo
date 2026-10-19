import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { defaultRolePayloads } from "../../packages/permissions/src";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function fixture(role: string) {
  const { user, workspace } = await createWorkspaceMember({ role });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      number: 1,
      title: "Tracked task",
      status: "to-do",
    })
    .returning();
  const [entry] = await db
    .insert(schema.timeEntryTable)
    .values({
      taskId: task.id,
      userId: user.id,
      startTime: new Date("2026-10-01T09:00:00Z"),
      endTime: new Date("2026-10-01T10:00:00Z"),
      duration: 3600,
    })
    .returning();
  mockAuthenticatedSession(user);
  return { workspace, task, entry, ...createApp() };
}

const times = {
  startTime: "2026-10-01T09:00:00Z",
  endTime: "2026-10-01T10:30:00Z",
};

function json(method: string, body: unknown) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("time-entry permissions", () => {
  it("keeps a task-editing client read-only for time, including direct API requests", async () => {
    const f = await fixture("client");
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: f.workspace.id,
      role: "client",
      permission: JSON.stringify({
        project: ["read"],
        task: ["create", "read", "update"],
        workspace: ["read"],
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(
      (await f.app.request(`/api/time-entry/task/${f.task.id}`)).status,
    ).toBe(200);
    expect((await f.app.request(`/api/time-entry/${f.entry.id}`)).status).toBe(
      200,
    );
    expect(
      (
        await f.app.request(
          `/api/task/title/${f.task.id}`,
          json("PUT", { title: "Client can edit tasks" }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await f.app.request(
          "/api/time-entry",
          json("POST", { taskId: f.task.id, ...times }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await f.app.request(`/api/time-entry/${f.entry.id}`, json("PUT", times)))
        .status,
    ).toBe(403);
    const unchanged = await db.query.timeEntryTable.findFirst({
      where: eq(schema.timeEntryTable.id, f.entry.id),
    });
    expect(unchanged?.duration).toBe(3600);
    expect(
      (await f.app.request(`/api/time-entry/task/${f.task.id}/total`)).status,
    ).toBe(200);
    expect(
      (
        await f.app.request(
          `/api/time-entry/task/${f.task.id}/total`,
          json("PUT", { totalSeconds: 0 }),
        )
      ).status,
    ).toBe(404);
    const capabilities = await (
      await f.app.request(`/api/workspace/${f.workspace.id}/capabilities`)
    ).json();
    expect(capabilities).toMatchObject({
      updateTasks: true,
      createTimeEntries: false,
      updateTimeEntries: false,
    });
  });

  it.each(["member", "admin"] as const)(
    "allows the default %s team role to log and edit time",
    async (role) => {
      const f = await fixture(role);
      await db.insert(schema.workspaceRoleTable).values({
        workspaceId: f.workspace.id,
        role,
        permission: JSON.stringify(defaultRolePayloads[role]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(
        (
          await f.app.request(
            "/api/time-entry",
            json("POST", { taskId: f.task.id, ...times }),
          )
        ).status,
      ).toBe(200);
      const updated = await f.app.request(
        `/api/time-entry/${f.entry.id}`,
        json("PUT", times),
      );
      expect(updated.status).toBe(200);
      expect((await updated.json()).duration).toBe(5400);
    },
  );

  it("upgrades default team roles while preserving custom roles and explicit restrictions", async () => {
    const f = await fixture("owner");
    const roles = [
      { role: "member", permission: { task: ["read", "update"] } },
      {
        role: "admin",
        permission: { task: ["read", "update"], timeEntry: [] },
      },
      { role: "client", permission: { task: ["read", "update"] } },
      { role: "viewer", permission: { task: ["read"] } },
    ];
    await db.insert(schema.workspaceRoleTable).values(
      roles.map(({ role, permission }) => ({
        workspaceId: f.workspace.id,
        role,
        permission: JSON.stringify(permission),
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    const migration = readFileSync(
      new URL(
        "../../apps/api/drizzle/0065_time_entry_permissions.sql",
        import.meta.url,
      ),
      "utf8",
    );
    // Re-running is safe and cannot re-enable a permission an admin has set.
    await db.execute(sql.raw(migration));
    await db.execute(sql.raw(migration));
    const stored = await db.query.workspaceRoleTable.findMany({
      where: eq(schema.workspaceRoleTable.workspaceId, f.workspace.id),
    });
    const permissions = Object.fromEntries(
      stored.map((row) => [row.role, JSON.parse(row.permission)]),
    );
    expect(permissions.member).toEqual({
      task: ["read", "update"],
      timeEntry: ["create", "update"],
    });
    expect(permissions.admin).toEqual(roles[1].permission);
    expect(permissions.client).toEqual(roles[2].permission);
    expect(permissions.viewer).toEqual(roles[3].permission);
  });
});
