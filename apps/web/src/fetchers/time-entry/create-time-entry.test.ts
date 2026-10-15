import { expect, it, vi } from "vite-plus/test";
const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@kaneo/libs", () => ({ client: { "time-entry": { $post: post } } }));
import createTimeEntry from "./create-time-entry";

it("sends the end time so a manual log cannot turn into a running timer", async () => {
  const entry = {
    taskId: "task",
    startTime: "2026-10-14T09:00:00Z",
    endTime: "2026-10-14T10:30:00Z",
    description: "Development",
  };
  post.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ id: "entry" }),
  });
  await createTimeEntry(entry);
  expect(post).toHaveBeenCalledWith({ json: entry });
});
