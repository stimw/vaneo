import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
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

async function fixture() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "WORK",
  });
  mockAuthenticatedSession(user);
  return { user, workspace, project, columns, app: createApp().app };
}

function reportUrl(
  projectId: string,
  from = "2026-10-01T00:00:00Z",
  to = "2026-11-01T00:00:00Z",
) {
  return `/api/task/completed-export/${projectId}?${new URLSearchParams({ from, to, timeZone: "UTC" })}`;
}

async function task(
  projectId: string,
  number: number,
  status = "done",
  completedAt: Date | null = new Date("2026-10-14T09:00:00Z"),
) {
  const [row] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: `Task ${number}`,
      number,
      status,
      ...(completedAt ? { completedAt } : {}),
    })
    .returning();
  if (!completedAt && status === "done")
    await db
      .update(schema.taskTable)
      .set({ completedAt: null })
      .where(eq(schema.taskTable.id, row.id));
  return row;
}

describe("completion timestamps", () => {
  it("survives edits and archival, clears on reopening, and records a fresh completion", async () => {
    const f = await fixture();
    const row = await task(f.project.id, 1, "to-do");
    const setStatus = (status: string) =>
      db
        .update(schema.taskTable)
        .set({ status })
        .where(eq(schema.taskTable.id, row.id))
        .returning();
    const [done] = await setStatus("done");
    expect(done.completedAt).toBeInstanceOf(Date);
    const [edited] = await db
      .update(schema.taskTable)
      .set({ title: "Edited after completion" })
      .where(eq(schema.taskTable.id, row.id))
      .returning();
    expect(edited.completedAt).toEqual(done.completedAt);
    const [archived] = await setStatus("archived");
    expect(archived.completedAt).toEqual(done.completedAt);
    const [reopened] = await setStatus("to-do");
    expect(reopened.completedAt).toBeNull();
    const [again] = await setStatus("done");
    expect(again.completedAt!.getTime()).toBeGreaterThanOrEqual(
      done.completedAt!.getTime(),
    );
  });
  it("follows custom final columns and retains the date between final columns", async () => {
    const f = await fixture();
    const row = await task(f.project.id, 1);
    await db.insert(schema.columnTable).values({
      projectId: f.project.id,
      slug: "delivered",
      name: "Delivered",
      isFinal: true,
    });
    const [moved] = await db
      .update(schema.taskTable)
      .set({ status: "delivered" })
      .where(eq(schema.taskTable.id, row.id))
      .returning();
    expect(moved.completedAt).toEqual(row.completedAt);
    await db
      .update(schema.columnTable)
      .set({ isFinal: false })
      .where(
        and(
          eq(schema.columnTable.projectId, f.project.id),
          eq(schema.columnTable.slug, "delivered"),
        ),
      );
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, row.id),
        })
      )?.completedAt,
    ).toBeNull();
  });
  it("backfills known history without treating last edits as completion", async () => {
    const f = await fixture();
    const known = await task(f.project.id, 1, "done", null);
    const unknown = await task(f.project.id, 2, "done", null);
    const date = new Date("2026-10-12T10:00:00Z");
    await db.insert(schema.activityTable).values({
      taskId: known.id,
      type: "status_changed",
      createdAt: date,
      eventData: { oldStatus: "to-do", newStatus: "done" },
    });
    const statements = readFileSync(
      new URL(
        "../../apps/api/drizzle/0064_task_completion.sql",
        import.meta.url,
      ),
      "utf8",
    ).split("--> statement-breakpoint");
    const backfill = statements.find((statement) =>
      statement.includes("UPDATE task t SET completed_at"),
    )!;
    await db.execute(sql.raw(backfill));
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, known.id),
        })
      )?.completedAt,
    ).toEqual(date);
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, unknown.id),
        })
      )?.completedAt,
    ).toBeNull();
  });
});

describe("completed task time reports", () => {
  it("includes boundary completions, all historical time, zero-time tasks and archived completions", async () => {
    const f = await fixture();
    const first = await task(
      f.project.id,
      1,
      "done",
      new Date("2026-10-01T00:00:00Z"),
    );
    const archived = await task(f.project.id, 2);
    await db
      .update(schema.taskTable)
      .set({ status: "archived" })
      .where(eq(schema.taskTable.id, archived.id));
    await task(f.project.id, 3, "done", new Date("2026-11-01T00:00:00Z"));
    await task(f.project.id, 4, "to-do");
    await task(f.project.id, 5, "done", null);
    await db.insert(schema.timeEntryTable).values([
      {
        taskId: first.id,
        userId: f.user.id,
        startTime: new Date("2026-09-01T09:00:00Z"),
        endTime: new Date("2026-09-01T10:30:00Z"),
        duration: 5400,
      },
      {
        taskId: first.id,
        userId: f.user.id,
        startTime: new Date("2026-10-01T10:00:00Z"),
        endTime: null,
        duration: null,
      },
    ]);
    const response = await f.app.request(reportUrl(f.project.id));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.tasks.map((row: { ticketId: string }) => row.ticketId)).toEqual(
      ["WORK-1", "WORK-2"],
    );
    expect(data.summary).toEqual({
      taskCount: 2,
      totalSeconds: 5400,
      runningEntryCount: 1,
      unknownCompletionCount: 1,
    });
    expect(data.tasks[0].timeEntries).toHaveLength(2);
    expect(data.tasks[1].totalSeconds).toBe(0);
    expect(data.tasks[0].timeEntries[0].userName).toBe(f.user.name);
  });
  it("does not silently stop at the board's first page", async () => {
    const f = await fixture();
    await db.insert(schema.taskTable).values(
      Array.from({ length: 120 }, (_, number) => ({
        projectId: f.project.id,
        number: number + 1,
        title: `Task ${number}`,
        status: "done",
        completedAt: new Date("2026-10-14T09:00:00Z"),
      })),
    );
    const response = await f.app.request(reportUrl(f.project.id));
    expect((await response.json()).tasks).toHaveLength(120);
  });
  it("rejects reversed/invalid periods and another workspace's project", async () => {
    const f = await fixture();
    expect(
      (
        await f.app.request(
          reportUrl(
            f.project.id,
            "2026-10-30T00:00:00Z",
            "2026-10-01T00:00:00Z",
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      (await f.app.request(reportUrl(f.project.id, "2026-02-30T00:00:00Z")))
        .status,
    ).toBe(400);
    const other = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    expect((await f.app.request(reportUrl(project.id))).status).toBe(404);
  });
  it("allows read-only viewing but forbids writing time without timeEntry:create", async () => {
    const f = await fixture();
    const row = await task(f.project.id, 1);
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "viewer" })
      .where(eq(schema.workspaceUserTable.userId, f.user.id));
    expect((await f.app.request(reportUrl(f.project.id))).status).toBe(200);
    expect((await f.app.request(`/api/time-entry/task/${row.id}`)).status).toBe(
      200,
    );
    expect(
      (
        await f.app.request("/api/time-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: row.id,
            startTime: "2026-10-14T09:00:00Z",
            endTime: "2026-10-14T10:00:00Z",
          }),
        })
      ).status,
    ).toBe(403);
  });
});
