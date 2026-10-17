import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  responseTimestamp,
  z,
  type BaseVariables,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { deleteWorklog } from "./controllers/delete-worklog";
import { getWorklogs } from "./controllers/get-worklogs";
import { saveWorklog } from "./controllers/save-worklog";

const params = z.object({ taskId: z.string() });
const entryParams = params.extend({ id: z.string() });
const body = z.object({
  workDate: z.iso.date(),
  duration: z
    .number()
    .int()
    .min(900)
    .max(86400)
    .multipleOf(900)
    .openapi({ multipleOf: 900 }),
});
const entry = z.object({
  id: z.string(),
  taskId: z.string(),
  userId: z.string().nullable(),
  workDate: z.string(),
  duration: z.number(),
  createdAt: responseTimestamp,
  updatedAt: responseTimestamp,
});
const access = () =>
  [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const;
const errors = {
  400: errorResponse("Invalid date, hours or paging"),
  403: errorResponse("No access or time editing permission"),
  404: errorResponse("Task or log not found"),
};
export const worklogs = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(
    createRoute({
      method: "get",
      operationId: "getTaskWorklogs",
      path: "/task/{taskId}/logs",
      tags: ["Time Entries"],
      summary: "Get dated time logs",
      description:
        "Returns a bounded page of date-only work logs and an unallocated historical adjustment. Historical task totals are never assigned an invented work date.",
      middleware: [...access()] as const,
      request: {
        params,
        query: z.object({
          page: z.coerce.number().int().min(1).max(1_000_000).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(10),
        }),
      },
      responses: {
        200: jsonResponse(
          "Time logs",
          z.object({
            entries: z.array(
              z.object({
                id: z.string(),
                workDate: z.string(),
                duration: z.number(),
                userName: z.string().nullable(),
                createdAt: responseTimestamp,
              }),
            ),
            total: z.number(),
            totalSeconds: z.number(),
            unallocatedSeconds: z.number(),
            nextPage: z.number().nullable(),
          }),
        ),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await getWorklogs(
          c.req.valid("param").taskId,
          c.req.valid("query").page,
          c.req.valid("query").limit,
        ),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "post",
      operationId: "logTaskTime",
      path: "/task/{taskId}/logs",
      tags: ["Time Entries"],
      summary: "Log hours on a work date",
      description:
        "Add 15 minutes to 24 hours in 15-minute increments to a date without inventing a start or end time. Duration is in seconds. The task's cumulative time increases by the logged duration.",
      middleware: [
        ...access(),
        requireWorkspacePermission({ timeEntry: ["create"] }),
      ] as const,
      request: {
        params,
        body: {
          required: true,
          content: { "application/json": { schema: body } },
        },
      },
      responses: { 200: jsonResponse("Saved time log", entry), ...errors },
    }),
    async (c) =>
      c.json(
        await saveWorklog({
          ...c.req.valid("param"),
          ...c.req.valid("json"),
          userId: c.get("userId"),
          workspaceId: c.get("workspaceId"),
        }),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "put",
      operationId: "updateTaskWorklog",
      path: "/task/{taskId}/logs/{id}",
      tags: ["Time Entries"],
      summary: "Correct a dated time log",
      description:
        "Set 15 minutes to 24 hours in 15-minute increments. Duration is in seconds. Existing historical logs remain readable without rounding.",
      middleware: [
        ...access(),
        requireWorkspacePermission({ timeEntry: ["update"] }),
      ] as const,
      request: {
        params: entryParams,
        body: {
          required: true,
          content: { "application/json": { schema: body } },
        },
      },
      responses: { 200: jsonResponse("Corrected time log", entry), ...errors },
    }),
    async (c) =>
      c.json(
        await saveWorklog({
          ...c.req.valid("param"),
          ...c.req.valid("json"),
          userId: c.get("userId"),
          workspaceId: c.get("workspaceId"),
        }),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "delete",
      operationId: "deleteTaskWorklog",
      path: "/task/{taskId}/logs/{id}",
      tags: ["Time Entries"],
      summary: "Remove an incorrect time log",
      description:
        "Requires timeEntry:update permission, the same permission used to correct logged time. Decreases the task total without removing historical time balances.",
      middleware: [
        ...access(),
        requireWorkspacePermission({ timeEntry: ["update"] }),
      ] as const,
      request: { params: entryParams },
      responses: {
        200: jsonResponse("Removed time log", z.object({ id: z.string() })),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await deleteWorklog(
          c.req.valid("param").taskId,
          c.req.valid("param").id,
          c.get("workspaceId"),
        ),
        200,
      ),
  );
