import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);
const period = {
  from: "2026-10-01T00:00:00Z",
  to: "2026-11-01T00:00:00Z",
  timeZone: "UTC",
};
async function fixture() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "CAT",
  });
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      [1, 2, 3].map((number) => ({
        projectId: project.id,
        number,
        title: `Task ${number}`,
        status: "done",
        completedAt: new Date("2026-10-15T10:00:00Z"),
      })),
    )
    .returning();
  const [field, unrelated] = await db
    .insert(schema.customFieldDefinitionTable)
    .values([
      {
        projectId: project.id,
        name: "Business category",
        type: "dropdown",
        options: ["Sales", "Marketing"],
      },
      {
        projectId: project.id,
        name: "Other field",
        type: "dropdown",
        options: ["One"],
      },
    ])
    .returning();
  await db.insert(schema.customFieldValueTable).values([
    { taskId: tasks[0].id, fieldId: field.id, value: "Sales" },
    { taskId: tasks[1].id, fieldId: field.id, value: "Marketing" },
    ...tasks.map((task) => ({
      taskId: task.id,
      fieldId: unrelated.id,
      value: "One",
    })),
  ]);
  await db.insert(schema.taskWorklogTable).values([
    {
      taskId: tasks[0].id,
      userId: user.id,
      workDate: "2026-10-10",
      duration: 1800,
    },
    {
      taskId: tasks[0].id,
      userId: user.id,
      workDate: "2026-10-11",
      duration: 1800,
    },
    {
      taskId: tasks[1].id,
      userId: user.id,
      workDate: "2026-10-10",
      duration: 7200,
    },
    {
      taskId: tasks[2].id,
      userId: user.id,
      workDate: "2026-10-10",
      duration: 900,
    },
  ]);
  mockAuthenticatedSession(user);
  const app = createApp().app;
  const request = (route: string, extra: Record<string, string> = {}) =>
    app.request(
      `/api/task/${route}/${project.id}?${new URLSearchParams({ ...period, categoryFieldId: field.id, ...extra })}`,
    );
  return { app, project, workspace, tasks, field, unrelated, request };
}

describe("single-select time report categories", () => {
  it("partitions both report bases without multiplying time by logs or other fields", async () => {
    const f = await fixture();
    for (const route of ["work-report", "completed-report"]) {
      const response = await f.request(route);
      expect(
        response.status,
        `${route}: ${await response.clone().text()}`,
      ).toBe(200);
      const report = await response.json();
      expect(report.summary.totalSeconds).toBe(11700);
      expect(report.categoryField.name).toBe("Business category");
      expect(report.categories).toEqual([
        { category: "Marketing", taskCount: 1, totalSeconds: 7200 },
        { category: "Sales", taskCount: 1, totalSeconds: 3600 },
        { category: null, taskCount: 1, totalSeconds: 900 },
      ]);
      expect(
        report.categories.reduce(
          (sum: number, row: { totalSeconds: number }) =>
            sum + row.totalSeconds,
          0,
        ),
      ).toBe(report.summary.totalSeconds);
      expect(
        report.categories.reduce(
          (sum: number, row: { taskCount: number }) => sum + row.taskCount,
          0,
        ),
      ).toBe(report.summary.taskCount);
      const filtered = await (
        await f.request(route, { category: "Sales" })
      ).json();
      expect(filtered.summary.totalSeconds).toBe(3600);
      expect(filtered.summary.taskCount).toBe(1);
      const empty = await (await f.request(route, { category: "" })).json();
      expect(empty.summary.totalSeconds).toBe(900);
    }
  });

  it("keeps pages and complete exports consistent with the selected category", async () => {
    const f = await fixture();
    for (const route of ["work-export", "completed-export"]) {
      const response = await f.request(route, { category: "Sales" });
      expect(
        response.status,
        `${route}: ${await response.clone().text()}`,
      ).toBe(200);
      const report = await response.json();
      expect(report.summary.totalSeconds).toBe(3600);
      expect(report.tasks).toHaveLength(1);
      expect(report.tasks[0].category).toBe("Sales");
      expect(report.categoryField.id).toBe(f.field.id);
    }
    const query = new URLSearchParams({
      ...period,
      categoryFieldId: f.field.id,
      category: "Sales",
      limit: "1",
    });
    const page = await (
      await f.app.request(
        `/api/task/completed-report/${f.project.id}/tasks?${query}`,
      )
    ).json();
    expect(page.summary.totalSeconds).toBe(3600);
    expect(page.tasks[0].category).toBe("Sales");
    expect(page.nextPage).toBeNull();
    const logged = await (
      await f.request("work-report", {
        category: "Sales",
        day: "2026-10-10",
        search: "Task 1",
      })
    ).json();
    expect(logged.summary.totalSeconds).toBe(1800);
    expect(logged.categories[0].totalSeconds).toBe(1800);
  });

  it("rejects cross-project fields, multiselect grouping and invalid category filters", async () => {
    const f = await fixture();
    const { project } = await createProjectFixture({
      workspaceId: f.workspace.id,
      slug: "OTHER",
    });
    const [other, multi] = await db
      .insert(schema.customFieldDefinitionTable)
      .values([
        {
          projectId: project.id,
          name: "Private field",
          type: "dropdown",
          options: ["Sales"],
        },
        {
          projectId: f.project.id,
          name: "Tags",
          type: "multiselect",
          options: ["Sales"],
        },
      ])
      .returning();
    for (const route of [
      "work-report",
      "completed-report",
      "work-export",
      "completed-export",
    ]) {
      expect(
        (await f.request(route, { categoryFieldId: other.id })).status,
      ).toBe(404);
      expect(
        (await f.request(route, { categoryFieldId: multi.id })).status,
      ).toBe(400);
      expect(
        (await f.request(route, { category: "not an option" })).status,
      ).toBe(400);
      const noField = await f.app.request(
        `/api/task/${route}/${f.project.id}?${new URLSearchParams({ ...period, category: "Sales" })}`,
      );
      expect(noField.status).toBe(400);
      const ungrouped = await (
        await f.app.request(
          `/api/task/${route}/${f.project.id}?${new URLSearchParams(period)}`,
        )
      ).json();
      expect(ungrouped.summary.totalSeconds).toBe(11700);
      expect(ungrouped.categoryField).toBeNull();
    }
  });
});
