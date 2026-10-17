import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  completedReportFilters,
  completedReportPageQuery,
} from "./completed-report-schema";
import { getWorkReport } from "./controllers/get-work-report";
import { workReportSchema } from "./work-report-schema";

const middleware = () =>
  [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const;
const errors = {
  400: errorResponse("Invalid period, filters or export too large"),
  403: errorResponse("No project access"),
  404: errorResponse("Project not found"),
  503: errorResponse("Report timed out"),
};
const params = z.object({ projectId: z.string() });
export const workReport = apiRouter()
  .openapi(
    createRoute({
      method: "get",
      operationId: "getLoggedTimeReport",
      path: "/work-report/{projectId}",
      tags: ["Tasks"],
      summary: "Get work logged in a period",
      description:
        "Includes ongoing and completed tasks with dated work logs. Totals count work dates in the requested time zone, not task completion dates. Date-only logs retain their explicit calendar date; stopped legacy timers belong to their start date. Running timers and undated historical adjustments are excluded. Task count is unique across the period. Page totals cover all matching tasks; at most 100 task rows are returned.",
      middleware: [...middleware()] as const,
      request: { params, query: completedReportPageQuery },
      responses: {
        200: jsonResponse("Logged work summary and page", workReportSchema),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await getWorkReport(
          c.req.valid("param").projectId,
          c.req.valid("query"),
        ),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "get",
      operationId: "exportLoggedTimeReport",
      path: "/work-export/{projectId}",
      tags: ["Tasks"],
      summary: "Export all matching tasks with logged work",
      middleware: [...middleware()] as const,
      description:
        "Exports up to 10,000 matching tasks with period time, cumulative time, estimates and current completion progress. Does not include descriptions or unrelated projects.",
      request: { params, query: completedReportFilters },
      responses: {
        200: jsonResponse("Logged work export", workReportSchema),
        ...errors,
      },
    }),
    async (c) => {
      const report = await getWorkReport(c.req.valid("param").projectId, {
        ...c.req.valid("query"),
        page: 1,
        limit: 10000,
      });
      if (report.nextPage)
        throw new HTTPException(400, {
          message: "Export exceeds 10,000 tasks; narrow the period",
        });
      return c.json(report, 200);
    },
  );
