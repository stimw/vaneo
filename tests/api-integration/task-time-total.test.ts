import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
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
function json(method: string, body: unknown) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
async function fixture() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Time total",
      number: 1,
      status: "done",
      completedAt: new Date("2026-10-14T09:00:00Z"),
    })
    .returning();
  const [entry] = await db
    .insert(schema.timeEntryTable)
    .values({
      taskId: task.id,
      userId: user.id,
      description: "Existing record",
      startTime: new Date("2026-09-01T09:00:00Z"),
      endTime: new Date("2026-09-01T10:00:00Z"),
      duration: 3600,
    })
    .returning();
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const url = `/api/time-entry/task/${task.id}/total`;
  return {
    user,
    project,
    task,
    entry,
    app,
    url,
    get: async () => (await app.request(url)).json(),
  };
}

describe("cumulative task time total", () => {
  it("removes the absolute-total write route while preserving historical balances and dated records", async () => {
    const f = await fixture();
    await db
      .update(schema.taskTable)
      .set({ trackedSeconds: 7200 })
      .where(eq(schema.taskTable.id, f.task.id));
    const logged = await f.app.request(
      `/api/time-entry/task/${f.task.id}/logs`,
      json("POST", { workDate: "2026-10-14", duration: 900 }),
    );
    expect(logged.status).toBe(200);
    const before = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, f.task.id),
    });
    const entries = await db.query.timeEntryTable.findMany({
      where: eq(schema.timeEntryTable.taskId, f.task.id),
    });
    const logs = await db.query.taskWorklogTable.findMany({
      where: eq(schema.taskWorklogTable.taskId, f.task.id),
    });
    for (const totalSeconds of [0, 1800, 8100, -1, null]) {
      expect(
        (await f.app.request(f.url, json("PUT", { totalSeconds }))).status,
      ).toBe(404);
    }
    expect(await f.get()).toEqual({ taskId: f.task.id, totalSeconds: 8100 });
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, f.task.id),
      }),
    ).toEqual(before);
    expect(
      await db.query.timeEntryTable.findMany({
        where: eq(schema.timeEntryTable.taskId, f.task.id),
      }),
    ).toEqual(entries);
    expect(
      await db.query.taskWorklogTable.findMany({
        where: eq(schema.taskWorklogTable.taskId, f.task.id),
      }),
    ).toEqual(logs);
    const detail = await (
      await f.app.request(`/api/time-entry/task/${f.task.id}/logs`)
    ).json();
    expect(detail).toMatchObject({
      totalSeconds: 8100,
      unallocatedSeconds: 3600,
      total: 1,
    });
    const spec = await (await f.app.request("/api/openapi")).json();
    expect(spec.paths["/time-entry/task/{taskId}/total"].get.operationId).toBe(
      "getTaskTime",
    );
    expect(spec.paths["/time-entry/task/{taskId}/total"].put).toBeUndefined();
  });

  it("keeps existing historical totals and exported values without rewriting legacy entries", async () => {
    const f = await fixture();
    await db.insert(schema.timeEntryTable).values({
      taskId: f.task.id,
      userId: f.user.id,
      startTime: new Date("2026-09-02T09:00:00Z"),
      endTime: new Date("2026-09-02T11:00:00Z"),
      duration: 7200,
    });
    const before = await db.query.timeEntryTable.findMany({
      where: eq(schema.timeEntryTable.taskId, f.task.id),
    });
    await db
      .update(schema.taskTable)
      .set({ trackedSeconds: 1800 })
      .where(eq(schema.taskTable.id, f.task.id));
    const report = await (
      await f.app.request(
        `/api/task/completed-export/${f.project.id}?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z`,
      )
    ).json();
    expect(report.summary.totalSeconds).toBe(1800);
    expect(report.tasks[0].totalSeconds).toBe(1800);
    expect(report.tasks[0].timeEntries).toHaveLength(2);
    expect(
      await db.query.timeEntryTable.findMany({
        where: eq(schema.timeEntryTable.taskId, f.task.id),
      }),
    ).toEqual(before);
    const task = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, f.task.id),
    });
    expect(task?.completedAt).toEqual(f.task.completedAt);
  });

  it("retains manual corrections as timers stop and existing entries change", async () => {
    const f = await fixture();
    await db
      .update(schema.taskTable)
      .set({ trackedSeconds: 7200 })
      .where(eq(schema.taskTable.id, f.task.id));
    const running = await (
      await f.app.request(
        "/api/time-entry",
        json("POST", { taskId: f.task.id, startTime: "2026-10-01T09:00:00Z" }),
      )
    ).json();
    expect((await f.get()).totalSeconds).toBe(7200);
    await f.app.request(
      `/api/time-entry/${running.id}`,
      json("PUT", {
        startTime: running.startTime,
        endTime: "2026-10-01T10:30:00Z",
      }),
    );
    expect((await f.get()).totalSeconds).toBe(12600);
    await f.app.request(
      `/api/time-entry/${f.entry.id}`,
      json("PUT", {
        startTime: f.entry.startTime.toISOString(),
        endTime: "2026-09-01T09:30:00Z",
      }),
    );
    expect((await f.get()).totalSeconds).toBe(10800);
    await db
      .delete(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, f.entry.id));
    expect((await f.get()).totalSeconds).toBe(9000);
    await db.delete(schema.taskTable).where(eq(schema.taskTable.id, f.task.id));
    expect((await f.app.request(f.url)).status).toBe(404);
  });

  it("serializes concurrent legacy time-entry additions", async () => {
    const f = await fixture();
    await db
      .update(schema.taskTable)
      .set({ trackedSeconds: 9000 })
      .where(eq(schema.taskTable.id, f.task.id));
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        f.app.request(
          "/api/time-entry",
          json("POST", {
            taskId: f.task.id,
            startTime: "2026-10-01T09:00:00Z",
            endTime: "2026-10-01T09:10:00Z",
          }),
        ),
      ),
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect((await f.get()).totalSeconds).toBe(11400);
  });

  it("backfills old entries from timestamps for cumulative reads", async () => {
    const f = await fixture();
    await db
      .update(schema.taskTable)
      .set({ trackedSeconds: 0 })
      .where(eq(schema.taskTable.id, f.task.id));
    const backfill = readFileSync(
      new URL(
        "../../apps/api/drizzle/0066_task_time_total.sql",
        import.meta.url,
      ),
      "utf8",
    )
      .split("--> statement-breakpoint")
      .find((s) => s.includes("UPDATE task t SET tracked_seconds"))!;
    await db.execute(sql.raw(backfill));
    expect((await f.get()).totalSeconds).toBe(3600);
  });
});
