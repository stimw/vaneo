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

async function fixture(role: string, permission: Record<string, string[]>) {
  const { user, workspace } = await createWorkspaceMember({ role });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId: workspace.id,
    role,
    permission: JSON.stringify(permission),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [field] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({
      projectId: project.id,
      name: "Business category",
      type: "dropdown",
      options: ["Marketing", "Sales"],
      required: true,
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      number: 1000,
      title: "T",
      status: "to-do",
    })
    .returning();
  await db
    .insert(schema.customFieldValueTable)
    .values({ taskId: task.id, fieldId: field.id, value: "Marketing" });
  mockAuthenticatedSession(user);
  return { workspace, project, field, task, ...createApp() };
}

function setValue(
  f: Awaited<ReturnType<typeof fixture>>,
  value: string,
): Promise<Response> {
  return f.app.request("/api/custom-field/value", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: f.task.id, fieldId: f.field.id, value }),
  });
}

async function storedValue(taskId: string) {
  const row = await db.query.customFieldValueTable.findFirst({
    where: eq(schema.customFieldValueTable.taskId, taskId),
  });
  return row?.value;
}

describe("custom field value permissions", () => {
  it("lets a client edit tasks but not change their category", async () => {
    const f = await fixture("client", defaultRolePayloads.client);
    expect((await setValue(f, "Sales")).status).toBe(403);
    expect(await storedValue(f.task.id)).toBe("Marketing");
    const capabilities = await (
      await f.app.request(`/api/workspace/${f.workspace.id}/capabilities`)
    ).json();
    expect(capabilities).toMatchObject({
      updateTasks: true,
      writeCustomFieldValues: false,
    });
  });

  it("lets a client create tasks without choosing a required category", async () => {
    const f = await fixture("client", defaultRolePayloads.client);
    const create = (body: Record<string, unknown>) =>
      f.app.request(`/api/task/${f.project.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Client request",
          description: "",
          status: "to-do",
          priority: "no-priority",
          ...body,
        }),
      });
    expect((await create({})).status).toBe(200);
    expect(
      (
        await create({
          customFields: [{ fieldId: f.field.id, value: "Sales" }],
        })
      ).status,
    ).toBe(403);
  });

  it("still requires a category from roles that can write it", async () => {
    const f = await fixture("member", defaultRolePayloads.member);
    const response = await f.app.request(`/api/task/${f.project.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Team task",
        description: "",
        status: "to-do",
        priority: "no-priority",
      }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("Business category");
  });

  it("allows a client role once customFieldValue:write is granted", async () => {
    const f = await fixture("client", {
      ...defaultRolePayloads.client,
      customFieldValue: ["write"],
    });
    expect((await setValue(f, "Sales")).status).toBe(200);
    expect(await storedValue(f.task.id)).toBe("Sales");
  });

  it.each(["member", "admin"] as const)(
    "keeps category editing for the default %s role",
    async (role) => {
      const f = await fixture(role, defaultRolePayloads[role]);
      expect((await setValue(f, "Sales")).status).toBe(200);
    },
  );

  it("upgrades stored team roles without granting clients or overriding restrictions", async () => {
    const f = await fixture("owner", { task: ["read"] });
    const roles = [
      { role: "member", permission: { task: ["read", "update"] } },
      {
        role: "admin",
        permission: { task: ["read", "update"], customFieldValue: [] },
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
        "../../apps/api/drizzle/0070_custom_field_value_permissions.sql",
        import.meta.url,
      ),
      "utf8",
    );
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
      customFieldValue: ["write"],
    });
    expect(permissions.admin).toEqual(roles[1].permission);
    expect(permissions.client).toEqual(roles[2].permission);
    expect(permissions.viewer).toEqual(roles[3].permission);
  });
});
