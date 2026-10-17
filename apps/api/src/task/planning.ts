import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { updateTaskPlanning } from "./controllers/update-task-planning";

const planning = z
  .object({
    estimatedSeconds: z
      .number()
      .int()
      .positive()
      .max(2_147_483_647)
      .nullable()
      .optional(),
    progress: z.number().int().min(0).max(100).nullable().optional(),
  })
  .refine(
    (value) =>
      value.estimatedSeconds !== undefined || value.progress !== undefined,
    "Provide an estimate or progress",
  );

export const taskPlanning = apiRouter<
  BaseVariables & { workspaceId: string }
>().openapi(
  createRoute({
    method: "patch",
    operationId: "updateTaskPlanning",
    path: "/{id}/planning",
    tags: ["Tasks"],
    summary: "Update a task's estimate and completion progress",
    description:
      "Requires timeEntry:update permission. Clients can read these fields but task:update alone cannot modify them. An empty value clears the estimate or progress. Completed statuses are displayed as 100% without replacing the saved manual percentage.",
    middleware: [
      workspaceAccess.fromTask(),
      requireWorkspacePermission({ timeEntry: ["update"] }),
    ] as const,
    request: {
      params: z.object({ id: z.string() }),
      body: {
        required: true,
        content: { "application/json": { schema: planning } },
      },
    },
    responses: {
      200: jsonResponse(
        "Saved task planning",
        z.object({
          id: z.string(),
          projectId: z.string(),
          estimatedSeconds: z.number().nullable(),
          progress: z.number().nullable(),
        }),
      ),
      400: errorResponse("Invalid estimate or progress"),
      403: errorResponse("No permission to edit task planning"),
      404: errorResponse("Task not found"),
    },
  }),
  async (c) =>
    c.json(
      await updateTaskPlanning(
        c.req.valid("param").id,
        c.get("workspaceId"),
        c.req.valid("json"),
      ),
      200,
    ),
);
