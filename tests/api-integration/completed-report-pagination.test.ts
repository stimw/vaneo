import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";
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

function url(projectId: string, path = "", query: Record<string, string> = {}) {
  return `/api/task/completed-report/${projectId}${path}?${new URLSearchParams({ ...period, ...query })}`;
}

async function fixture(size = 31) {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "WORK",
  });
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      Array.from({ length: size }, (_, i) => ({
        projectId: project.id,
        title: `Task ${i + 1}`,
        number: i + 1,
        status: "done",
        completedAt: new Date("2026-10-14T09:00:00Z"),
        trackedSeconds: i === 0 ? 3600 : i === 1 ? 7200 : 0,
      })),
    )
    .returning();
  mockAuthenticatedSession(user);
  return { app: createApp().app, user, workspace, project, tasks };
}

describe("paginated completed reports", () => {
  it("returns stable, bounded pages and full aggregates without loading descriptions or time entries", async () => {
    const f = await fixture();
    const response = await f.app.request(url(f.project.id));
    expect(response.status, await response.clone().text()).toBe(200);
    const summary = await response.json();
    expect(summary.summary).toEqual({
      taskCount: 31,
      totalSeconds: 10800,
      zeroCount: 29,
      unknownCompletionCount: 0,
    });
    expect(summary.activity).toEqual([
      { date: "2026-10-14", taskCount: 31, totalSeconds: 10800 },
    ]);
    expect(
      summary.topTasks.map((task: { ticketId: string }) => task.ticketId),
    ).toEqual(["WORK-2", "WORK-1"]);
    expect(summary.tasks).toBeUndefined();
    const ids: string[] = [];
    for (let page = 1; page <= 4; page++) {
      const response = await f.app.request(
        url(f.project.id, "/tasks", { page: String(page), limit: "10" }),
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.summary.totalSeconds).toBe(10800);
      expect(data.summary.taskCount).toBe(31);
      expect(data.tasks).toHaveLength(page === 4 ? 1 : 10);
      expect(data.nextPage).toBe(page === 4 ? null : page + 1);
      expect(data.tasks[0]).not.toHaveProperty("timeEntries");
      expect(data.tasks[0]).not.toHaveProperty("description");
      ids.push(...data.tasks.map((task: { id: string }) => task.id));
    }
    expect(ids).toEqual(f.tasks.map((task) => task.id));
    expect(new Set(ids).size).toBe(31);
    const sorted = await (
      await f.app.request(
        url(f.project.id, "/tasks", { sort: "time", limit: "1" }),
      )
    ).json();
    expect(sorted.tasks[0].id).toBe(f.tasks[1].id);
    const empty = await (
      await f.app.request(
        url(f.project.id, "/tasks", { page: "5", limit: "10" }),
      )
    ).json();
    expect(empty.tasks).toEqual([]);
    expect(empty.nextPage).toBeNull();
    // Export remains complete even when the browser has loaded just one page.
    const exportResponse = await f.app.request(
      `/api/task/completed-export/${f.project.id}?${new URLSearchParams({ ...period, search: "Task", sort: "time" })}`,
    );
    const exported = await exportResponse.json();
    expect(exported.tasks).toHaveLength(31);
    expect(exported.tasks[0].id).toBe(f.tasks[1].id);
    expect(exported.summary.totalSeconds).toBe(10800);
  });

  it("combines timezone-aware day, literal search, assignee and zero-time filters on the server and export", async () => {
    const f = await fixture(3);
    await db
      .update(schema.taskTable)
      .set({
        title: "Rate_100% corrected",
        userId: f.user.id,
        completedAt: new Date("2026-10-01T15:30:00Z"),
        trackedSeconds: 0,
      })
      .where(eq(schema.taskTable.id, f.tasks[0].id));
    await db
      .update(schema.taskTable)
      .set({
        title: "RateX1000 corrected",
        completedAt: new Date("2026-10-02T14:00:00Z"),
      })
      .where(eq(schema.taskTable.id, f.tasks[1].id));
    const filters = {
      day: "2026-10-02",
      timeZone: "Australia/Sydney",
      search: "_100%",
      zeroOnly: "true",
    };
    const data = await (
      await f.app.request(url(f.project.id, "/tasks", filters))
    ).json();
    expect(data.tasks.map((task: { id: string }) => task.id)).toEqual([
      f.tasks[0].id,
    ]);
    expect(data.summary).toEqual({
      taskCount: 1,
      totalSeconds: 0,
      zeroCount: 1,
    });
    const fixedOffset = await (
      await f.app.request(
        url(f.project.id, "/tasks", { ...filters, timeZone: "+10:00" }),
      )
    ).json();
    expect(fixedOffset.tasks.map((task: { id: string }) => task.id)).toEqual([
      f.tasks[0].id,
    ]);
    const byName = await (
      await f.app.request(url(f.project.id, "/tasks", { search: f.user.name }))
    ).json();
    expect(byName.summary.taskCount).toBe(1);
    const ticket = await (
      await f.app.request(url(f.project.id, "/tasks", { search: "work-2" }))
    ).json();
    expect(ticket.tasks[0].id).toBe(f.tasks[1].id);
    const empty = await (
      await f.app.request(url(f.project.id, "/tasks", { search: "missing" }))
    ).json();
    expect(empty.tasks).toEqual([]);
    expect(empty.summary).toEqual({
      taskCount: 0,
      totalSeconds: 0,
      zeroCount: 0,
    });
    const exported = await (
      await f.app.request(
        `/api/task/completed-export/${f.project.id}?${new URLSearchParams({ ...period, ...filters })}`,
      )
    ).json();
    expect(exported.tasks.map((task: { id: string }) => task.id)).toEqual([
      f.tasks[0].id,
    ]);
    const summary = await (
      await f.app.request(
        url(f.project.id, "", { timeZone: "Australia/Sydney" }),
      )
    ).json();
    expect(summary.activity[0].date).toBe("2026-10-02");
  });

  it("enforces project access while allowing read-only workspace members", async () => {
    const f = await fixture(1);
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "viewer" })
      .where(eq(schema.workspaceUserTable.userId, f.user.id));
    expect((await f.app.request(url(f.project.id))).status).toBe(200);
    expect((await f.app.request(url(f.project.id, "/tasks"))).status).toBe(200);
    const other = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    expect((await f.app.request(url(project.id))).status).toBe(404);
    expect((await f.app.request(url(project.id, "/tasks"))).status).toBe(404);
    const hidden = await createProjectFixture({ workspaceId: f.workspace.id });
    await restrictToProjects(f.workspace.id, f.user.id, [f.project.id]);
    expect((await f.app.request(url(f.project.id))).status).toBe(200);
    expect((await f.app.request(url(hidden.project.id))).status).toBe(403);
    expect((await f.app.request(url(hidden.project.id, "/tasks"))).status).toBe(
      403,
    );
  });

  it("rejects invalid pagination, dates, timezone and reversed periods", async () => {
    const f = await fixture(1);
    for (const query of [
      { page: "0" },
      { limit: "101" },
      { limit: "1.5" },
      { day: "2026-02-30" },
      { timeZone: "bad-zone" },
      { from: period.to, to: period.from },
    ]) {
      expect(
        (await f.app.request(url(f.project.id, "/tasks", query))).status,
      ).toBe(400);
    }
  });
});
