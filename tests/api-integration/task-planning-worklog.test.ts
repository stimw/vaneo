import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

beforeEach(resetTestDatabase);
const period = {
  from: "2026-10-01T00:00:00Z",
  to: "2026-11-01T00:00:00Z",
  timeZone: "UTC",
};
const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
async function fixture(role = "owner") {
  const { user, workspace } = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "WORK",
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Long running _100% change",
      number: 1,
      status: "in-progress",
      columnId: columns.inProgress.id,
      trackedSeconds: 36000,
    })
    .returning();
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const logs = `/api/time-entry/task/${task.id}/logs`;
  const planning = `/api/task/${task.id}/planning`;
  const report = (query: Record<string, string> = {}, route = "work-report") =>
    app.request(
      `/api/task/${route}/${project.id}?${new URLSearchParams({ ...period, ...query })}`,
    );
  return {
    user,
    workspace,
    project,
    task,
    columns,
    app,
    logs,
    planning,
    report,
  };
}

describe("task planning and dated time", () => {
  it("saves independent estimates and progress, returns them on board/detail, and clears values", async () => {
    const f = await fixture();
    const updated = await f.app.request(
      f.planning,
      json("PATCH", { estimatedSeconds: 288000, progress: 45 }),
    );
    expect(updated.status, await updated.clone().text()).toBe(200);
    expect(await updated.json()).toMatchObject({
      estimatedSeconds: 288000,
      progress: 45,
    });
    for (const path of [
      `/api/task/${f.task.id}`,
      `/api/task/${f.task.id}?view=board`,
    ]) {
      const response = await f.app.request(path);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        estimatedSeconds: 288000,
        progress: 45,
        trackedSeconds: 36000,
      });
    }
    for (const values of [
      { progress: 101 },
      { progress: -1 },
      { progress: 1.5 },
      { estimatedSeconds: 0 },
      { estimatedSeconds: -1 },
      {},
    ])
      expect(
        (await f.app.request(f.planning, json("PATCH", values))).status,
      ).toBe(400);
    expect(
      (
        await f.app.request(
          f.planning,
          json("PATCH", { estimatedSeconds: null, progress: null }),
        )
      ).status,
    ).toBe(200);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, f.task.id),
      }),
    ).toMatchObject({
      estimatedSeconds: null,
      progress: null,
      trackedSeconds: 36000,
    });
  });

  it("adds, edits, removes and paginates logs while preserving the historical balance", async () => {
    const f = await fixture();
    const created = await f.app.request(
      f.logs,
      json("POST", { workDate: "2026-10-05", duration: 7200 }),
    );
    expect(created.status, await created.clone().text()).toBe(200);
    const entry = await created.json();
    let list = await (await f.app.request(f.logs)).json();
    expect(list).toMatchObject({
      totalSeconds: 43200,
      unallocatedSeconds: 36000,
      total: 1,
    });
    expect(list.entries[0]).toMatchObject({
      workDate: "2026-10-05",
      duration: 7200,
    });
    expect(
      (
        await f.app.request(
          `${f.logs}/${entry.id}`,
          json("PUT", { workDate: "2026-10-06", duration: 10800 }),
        )
      ).status,
    ).toBe(200);
    list = await (await f.app.request(f.logs)).json();
    expect(list).toMatchObject({
      totalSeconds: 46800,
      unallocatedSeconds: 36000,
    });
    expect(list.entries[0].workDate).toBe("2026-10-06");
    const responses = await Promise.all(
      [1, 2, 3].map((day) =>
        f.app.request(
          f.logs,
          json("POST", { workDate: `2026-10-0${day}`, duration: 3600 }),
        ),
      ),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    const first = await (await f.app.request(`${f.logs}?limit=2`)).json();
    expect(first).toMatchObject({ total: 4, nextPage: 2, totalSeconds: 57600 });
    const second = await (
      await f.app.request(`${f.logs}?limit=2&page=2`)
    ).json();
    expect(
      new Set([...first.entries, ...second.entries].map((entry) => entry.id))
        .size,
    ).toBe(4);
    expect(
      (await f.app.request(`${f.logs}/${entry.id}`, { method: "DELETE" }))
        .status,
    ).toBe(200);
    expect(await (await f.app.request(f.logs)).json()).toMatchObject({
      totalSeconds: 46800,
      unallocatedSeconds: 36000,
    });
  });

  it("records time without locking the entire project", async () => {
    const f = await fixture();
    await db.transaction(async (tx) => {
      await tx
        .select({ id: schema.projectTable.id })
        .from(schema.projectTable)
        .where(eq(schema.projectTable.id, f.project.id))
        .for("update");
      const response = await f.app.request(
        f.logs,
        json("POST", { workDate: "2026-10-01", duration: 3600 }),
      );
      expect(response.status, await response.clone().text()).toBe(200);
    });
    expect(await (await f.app.request(f.logs)).json()).toMatchObject({
      totalSeconds: 39600,
      total: 1,
    });
  });

  it("rejects invalid date/duration and prevents modifying a log through another task", async () => {
    const f = await fixture();
    for (const values of [
      { workDate: "2026-02-30", duration: 3600 },
      { workDate: "2026-10-01", duration: 0 },
      { workDate: "2026-10-01", duration: 86401 },
      { workDate: "2026-10-01", duration: 1.1 },
    ])
      expect((await f.app.request(f.logs, json("POST", values))).status).toBe(
        400,
      );
    const entry = await (
      await f.app.request(
        f.logs,
        json("POST", { workDate: "2026-10-01", duration: 3600 }),
      )
    ).json();
    const [other] = await db
      .insert(schema.taskTable)
      .values({
        projectId: f.project.id,
        title: "Other",
        number: 2,
        status: "to-do",
      })
      .returning();
    const path = `/api/time-entry/task/${other.id}/logs/${entry.id}`;
    expect(
      (
        await f.app.request(
          path,
          json("PUT", { workDate: "2026-10-01", duration: 1 }),
        )
      ).status,
    ).toBe(404);
    expect((await f.app.request(path, { method: "DELETE" })).status).toBe(404);
    expect(await (await f.app.request(f.logs)).json()).toMatchObject({
      totalSeconds: 39600,
      total: 1,
    });
    await db.delete(schema.taskTable).where(eq(schema.taskTable.id, f.task.id));
    expect(await db.query.taskWorklogTable.findMany()).toHaveLength(0);
  });

  it("keeps clients read-only for planning and logs despite task:update permission", async () => {
    const f = await fixture("client");
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: f.workspace.id,
      role: "client",
      permission: JSON.stringify({
        project: ["read"],
        workspace: ["read"],
        task: ["create", "read", "update"],
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const [entry] = await db
      .insert(schema.taskWorklogTable)
      .values({
        taskId: f.task.id,
        userId: f.user.id,
        workDate: "2026-10-01",
        duration: 3600,
      })
      .returning();
    expect((await f.app.request(f.logs)).status).toBe(200);
    expect((await f.report()).status).toBe(200);
    expect(
      (await f.app.request(f.planning, json("PATCH", { progress: 50 }))).status,
    ).toBe(403);
    expect(
      (
        await f.app.request(
          f.logs,
          json("POST", { workDate: "2026-10-01", duration: 3600 }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await f.app.request(
          `${f.logs}/${entry.id}`,
          json("PUT", { workDate: "2026-10-01", duration: 1 }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await f.app.request(`${f.logs}/${entry.id}`, { method: "DELETE" }))
        .status,
    ).toBe(403);
  });

  it("reports period hours of ongoing tasks independently of lifetime and completion date", async () => {
    const f = await fixture();
    await f.app.request(
      f.planning,
      json("PATCH", { estimatedSeconds: 288000, progress: 45 }),
    );
    await db.insert(schema.taskWorklogTable).values([
      { taskId: f.task.id, workDate: "2026-09-30", duration: 7200 },
      { taskId: f.task.id, workDate: "2026-10-01", duration: 3600 },
      { taskId: f.task.id, workDate: "2026-10-05", duration: 10800 },
      { taskId: f.task.id, workDate: "2026-11-01", duration: 7200 },
    ]);
    const response = await f.report();
    expect(response.status, await response.clone().text()).toBe(200);
    const report = await response.json();
    expect(report.summary).toMatchObject({ taskCount: 1, totalSeconds: 14400 });
    expect(report.tasks[0]).toMatchObject({
      completedAt: null,
      totalSeconds: 14400,
      trackedSeconds: 64800,
      estimatedSeconds: 288000,
      progress: 45,
      loggedAt: "2026-10-05",
    });
    expect(report.activity).toEqual([
      { date: "2026-10-01", taskCount: 1, totalSeconds: 3600 },
      { date: "2026-10-05", taskCount: 1, totalSeconds: 10800 },
    ]);
    const day = await (
      await f.report({ day: "2026-10-01", search: "_100%" })
    ).json();
    expect(day.summary.totalSeconds).toBe(3600);
    const noMatch = await (await f.report({ search: "missing" })).json();
    expect(noMatch.summary.taskCount).toBe(0);
    const completed = await (await f.report({}, "completed-report")).json();
    expect(completed.summary.taskCount).toBe(0);
    await db
      .update(schema.taskTable)
      .set({ status: "done", columnId: f.columns.done.id })
      .where(eq(schema.taskTable.id, f.task.id));
    expect((await (await f.report()).json()).tasks[0].progress).toBe(100);
    await db
      .update(schema.taskTable)
      .set({ status: "in-progress", columnId: f.columns.inProgress.id })
      .where(eq(schema.taskTable.id, f.task.id));
    expect((await (await f.report()).json()).tasks[0].progress).toBe(45);
    expect(
      (await (await f.report({}, "work-export")).json()).tasks,
    ).toHaveLength(1);
  });

  it("supports stopped legacy timers by local start day while excluding running timers and historical totals", async () => {
    const f = await fixture();
    await db.insert(schema.timeEntryTable).values([
      {
        taskId: f.task.id,
        userId: f.user.id,
        startTime: new Date("2026-10-01T15:30:00Z"),
        endTime: new Date("2026-10-01T16:30:00Z"),
        duration: 3600,
      },
      {
        taskId: f.task.id,
        userId: f.user.id,
        startTime: new Date("2026-10-01T17:00:00Z"),
      },
    ]);
    for (const timeZone of ["Asia/Shanghai", "+08:00"]) {
      const response = await f.report({ timeZone, day: "2026-10-01" });
      expect(response.status, await response.clone().text()).toBe(200);
      const report = await response.json();
      expect(report.summary).toMatchObject({
        taskCount: 1,
        totalSeconds: 3600,
      });
      expect(report.activity[0].date).toBe("2026-10-01");
    }
    expect(await (await f.app.request(f.logs)).json()).toMatchObject({
      totalSeconds: 39600,
      unallocatedSeconds: 36000,
    });
  });

  it("returns stable pages, full exports and literal searches without loading task descriptions", async () => {
    const f = await fixture();
    const tasks = await db
      .insert(schema.taskTable)
      .values(
        Array.from({ length: 13 }, (_, i) => ({
          projectId: f.project.id,
          title: `Work ${i}`,
          number: i + 2,
          status: "in-progress",
          progress: 25,
        })),
      )
      .returning();
    await db.insert(schema.taskWorklogTable).values(
      tasks.map((task) => ({
        taskId: task.id,
        workDate: "2026-10-04",
        duration: 3600,
      })),
    );
    const first = await (await f.report({ limit: "10" })).json();
    const next = await (await f.report({ limit: "10", page: "2" })).json();
    expect(first.summary).toMatchObject({ taskCount: 13, totalSeconds: 46800 });
    expect(first.tasks).toHaveLength(10);
    expect(next.tasks).toHaveLength(3);
    expect(first.tasks[0]).not.toHaveProperty("description");
    expect(
      new Set([...first.tasks, ...next.tasks].map((task) => task.id)).size,
    ).toBe(13);
    const exported = await (await f.report({}, "work-export")).json();
    expect(exported.tasks).toHaveLength(13);
    expect(
      (await (await f.report({ search: "WORK-4" })).json()).tasks[0].number,
    ).toBeUndefined();
    expect(
      (await (await f.report({ search: "WORK-4" })).json()).tasks,
    ).toHaveLength(1);
  });

  it("enforces workspace and restricted project access on every new read/write path", async () => {
    const f = await fixture();
    const other = await createWorkspaceMember({ role: "owner" });
    const hidden = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    const [hiddenTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: hidden.project.id,
        title: "Secret",
        number: 1,
        status: "to-do",
      })
      .returning();
    expect(
      (await f.app.request(`/api/time-entry/task/${hiddenTask.id}/logs`))
        .status,
    ).toBe(404);
    expect(
      (
        await f.app.request(
          `/api/task/${hiddenTask.id}/planning`,
          json("PATCH", { progress: 10 }),
        )
      ).status,
    ).toBe(404);
    const privateProject = await createProjectFixture({
      workspaceId: f.workspace.id,
    });
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "member" })
      .where(eq(schema.workspaceUserTable.userId, f.user.id));
    await restrictToProjects(f.workspace.id, f.user.id, [
      privateProject.project.id,
    ]);
    expect((await f.app.request(f.logs)).status).toBe(403);
    expect((await f.report()).status).toBe(403);
    expect(
      (await f.app.request(f.planning, json("PATCH", { progress: 10 }))).status,
    ).toBe(403);
  });
});
