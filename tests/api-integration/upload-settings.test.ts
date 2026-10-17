import { createHash, randomUUID } from "node:crypto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { S3Client } from "../../apps/api/node_modules/@aws-sdk/client-s3";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const MIB = 1024 * 1024;

function saveLimit(
  app: ReturnType<typeof createApp>["app"],
  maxUploadBytes: unknown,
  headers = {},
) {
  return app.request("/api/admin/upload-settings", {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ maxUploadBytes }),
  });
}

async function fixture() {
  const member = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      userId: member.user.id,
      title: "Attachment limit test",
      status: "to-do",
      columnId: columns.todo.id,
      priority: "medium",
      number: 1,
      position: 1,
    })
    .returning();
  return { ...member, project, task };
}

describe("API integration: instance upload settings", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.stubEnv("S3_MAX_IMAGE_UPLOAD_BYTES", String(10 * MIB));
    vi.stubEnv("S3_ENDPOINT", "https://storage.example.test");
    vi.stubEnv("S3_BUCKET", "test-bucket");
    vi.stubEnv("S3_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-secret-key");
    vi.stubEnv("S3_KEY_PREFIX", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses the environment default until an administrator saves a limit", async () => {
    vi.stubEnv("S3_MAX_IMAGE_UPLOAD_BYTES", String(12 * MIB));
    const response = await createApp().app.request("/api/config");
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("maxUploadBytes", 12 * MIB);
    expect(await db.query.instanceSettingsTable.findMany()).toEqual([]);
  });

  it("persists the administrator's setting across app instances and exposes it without secrets", async () => {
    mockAuthenticatedSession(await createInstanceAdmin());
    const { app } = createApp();
    const response = await saveLimit(app, 25 * MIB);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ maxUploadBytes: 25 * MIB });
    vi.stubEnv("S3_MAX_IMAGE_UPLOAD_BYTES", String(5 * MIB));
    const config = await createApp().app.request("/api/config");
    const payload = await config.json();
    expect(payload.maxUploadBytes).toBe(25 * MIB);
    expect(JSON.stringify(payload)).not.toContain("test-secret-key");
    expect(await db.query.instanceSettingsTable.findMany()).toHaveLength(1);
  });

  it.each([0, -1, MIB - 1, 1024 * MIB + 1, 1.5 * MIB + 0.1, "25", null])(
    "rejects an invalid limit %s without changing the previous value",
    async (limit) => {
      mockAuthenticatedSession(await createInstanceAdmin());
      const { app } = createApp();
      expect((await saveLimit(app, 25 * MIB)).status).toBe(200);
      expect((await saveLimit(app, limit)).status).toBe(400);
      expect(
        (await db.query.instanceSettingsTable.findFirst())?.maxUploadBytes,
      ).toBe(25 * MIB);
    },
  );

  it("rejects anonymous users and workspace owners", async () => {
    mockAnonymousSession();
    const { app } = createApp();
    expect((await saveLimit(app, 25 * MIB)).status).toBe(401);
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    expect((await saveLimit(app, 25 * MIB)).status).toBe(403);
    expect(await db.query.instanceSettingsTable.findMany()).toEqual([]);
  });

  it("rejects an administrator's API key", async () => {
    const admin = await createInstanceAdmin();
    mockAnonymousSession();
    const key = `test_${randomUUID()}`;
    await db.insert(schema.apikeyTable).values({
      referenceId: admin.id,
      userId: admin.id,
      key: createHash("sha256").update(key).digest("base64url"),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(
      (await saveLimit(createApp().app, 25 * MIB, { "x-api-key": key })).status,
    ).toBe(403);
  });

  it("applies increases and reductions to task, draft and background uploads immediately", async () => {
    const { user, project, task } = await fixture();
    const admin = await createInstanceAdmin();
    const { app } = createApp();
    mockAuthenticatedSession(admin);
    expect((await saveLimit(app, 25 * MIB)).status).toBe(200);
    mockAuthenticatedSession(user);
    const request = (path: string, method: string, size: number) =>
      app.request(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: "large.png",
          contentType: "image/png",
          size,
          surface: "description",
        }),
      });
    const paths = [
      [`/api/task/image-upload/${task.id}`, "PUT"],
      [`/api/task/draft-upload/${project.id}`, "POST"],
      [`/api/project/${project.id}/background-upload`, "PUT"],
    ];
    for (const [path, method] of paths) {
      expect((await request(path!, method!, 20 * MIB)).status).toBe(200);
    }
    mockAuthenticatedSession(admin);
    expect((await saveLimit(app, 1 * MIB)).status).toBe(200);
    mockAuthenticatedSession(user);
    for (const [path, method] of paths) {
      const response = await request(path!, method!, 2 * MIB);
      expect(response.status).toBe(400);
      expect(JSON.stringify(await response.json())).toContain("1 MiB");
      expect((await request(path!, method!, 1 * MIB)).status).toBe(200);
    }
  });

  it("finalizes an attachment above the old environment limit and keeps it when the limit is reduced", async () => {
    const { user, workspace, project, task } = await fixture();
    const admin = await createInstanceAdmin();
    const { app } = createApp();
    mockAuthenticatedSession(admin);
    await saveLimit(app, 25 * MIB);
    mockAuthenticatedSession(user);
    const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue({
      ContentLength: 20 * MIB,
      ContentType: "application/pdf",
    });
    const response = await app.request(
      `/api/task/image-upload/${task.id}/finalize`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: `workspace/${workspace.id}/project/${project.id}/task/${task.id}/descriptions/file.pdf`,
          filename: "file.pdf",
          contentType: "application/pdf",
          size: 20 * MIB,
          surface: "description",
        }),
      },
    );
    expect(response.status).toBe(200);
    const asset = await response.json();
    mockAuthenticatedSession(admin);
    await saveLimit(app, 1 * MIB);
    expect(await db.query.assetTable.findFirst()).toMatchObject({
      id: asset.id,
      size: 20 * MIB,
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("rejects and removes an oversized object uploaded using an older URL", async () => {
    const { user, workspace, project, task } = await fixture();
    const { app } = createApp();
    mockAuthenticatedSession(await createInstanceAdmin());
    await saveLimit(app, 1 * MIB);
    mockAuthenticatedSession(user);
    const key = `workspace/${workspace.id}/project/${project.id}/task/${task.id}/descriptions/old.png`;
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValueOnce({
        ContentLength: 20 * MIB,
        ContentType: "image/png",
      })
      .mockResolvedValueOnce({});
    const response = await app.request(
      `/api/task/image-upload/${task.id}/finalize`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key,
          filename: "old.png",
          contentType: "image/png",
          size: MIB,
          surface: "description",
        }),
      },
    );
    expect(response.status).toBe(400);
    expect(
      send.mock.calls.map(([command]) => command.constructor.name),
    ).toEqual(["HeadObjectCommand", "DeleteObjectCommand"]);
    expect(await db.query.assetTable.findMany()).toEqual([]);
  });
});
