import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { worklogs } from "./worklogs";
import createTimeEntry from "./controllers/create-time-entry";
import getTimeEntriesByTaskId from "./controllers/get-time-entries";
import getTimeEntry from "./controllers/get-time-entry";
import updateTimeEntry from "./controllers/update-time-entry";
import getTaskTime from "./controllers/get-task-time";
import setTaskTime from "./controllers/set-task-time";
import {
  timeEntryListSchema,
  timeEntrySchema,
  taskTimeSchema,
} from "./response";
import {
  createTimeEntryBody,
  taskIdParam,
  setTaskTimeBody,
  timeEntryParam,
  updateTimeEntryBody,
} from "./schema";

const getTaskTimeEntriesRoute = createRoute({
  method: "get",
  operationId: "getTaskTimeEntries",
  path: "/task/{taskId}",
  tags: ["Time Entries"],
  summary: "Get task time entries",
  description: "Get every time entry logged against a task.",
  middleware: [workspaceAccess.fromTaskId()] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("List of time entries for the task", timeEntryListSchema),
    403: errorResponse("No access to the project"),
    404: errorResponse("Task not found"),
  },
});

const getTimeEntryRoute = createRoute({
  method: "get",
  operationId: "getTimeEntry",
  path: "/{id}",
  tags: ["Time Entries"],
  summary: "Get time entry",
  description: "Get a single time entry by ID.",
  middleware: [workspaceAccess.fromTimeEntry()] as const,
  request: { params: timeEntryParam },
  responses: {
    200: jsonResponse("Time entry details", timeEntrySchema),
    403: errorResponse("No access to the project"),
    404: errorResponse("Time entry not found"),
  },
});

const createTimeEntryRoute = createRoute({
  method: "post",
  operationId: "createTimeEntry",
  path: "/",
  tags: ["Time Entries"],
  summary: "Create time entry",
  description:
    "Log time against a task. Omit endTime to start a running entry that can be closed later with an update.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ timeEntry: ["create"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createTimeEntryBody } },
    },
  },
  responses: {
    200: jsonResponse("The created time entry", timeEntrySchema),
    400: errorResponse("Invalid body or timestamps"),
    403: errorResponse(
      "No access to the project, or missing timeEntry:create permission",
    ),
    404: errorResponse("Task not found"),
  },
});

const updateTimeEntryRoute = createRoute({
  method: "put",
  operationId: "updateTimeEntry",
  path: "/{id}",
  tags: ["Time Entries"],
  summary: "Update time entry",
  description:
    "Replace a time entry's start, end, and description. Setting endTime closes a running entry and fills in its duration.",
  middleware: [
    workspaceAccess.fromTimeEntry(),
    requireWorkspacePermission({ timeEntry: ["update"] }),
  ] as const,
  request: {
    params: timeEntryParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateTimeEntryBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated time entry", timeEntrySchema),
    400: errorResponse("Invalid timestamps"),
    403: errorResponse(
      "No access to the project, or missing timeEntry:update permission",
    ),
    404: errorResponse("Time entry not found"),
  },
});

const getTaskTimeRoute = createRoute({
  method: "get",
  operationId: "getTaskTime",
  path: "/task/{taskId}/total",
  tags: ["Time Entries"],
  summary: "Get the task's time total",
  description:
    "Read the manually editable task total in seconds. Running entries are excluded until stopped.",
  middleware: [workspaceAccess.fromTaskId()] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("Task time total", taskTimeSchema),
    403: errorResponse("No access to the project"),
    404: errorResponse("Task not found"),
  },
});

const setTaskTimeRoute = createRoute({
  method: "put",
  operationId: "setTaskTime",
  path: "/task/{taskId}/total",
  tags: ["Time Entries"],
  summary: "Set the task's time total",
  description:
    "Set an absolute total in seconds without deleting existing time entries. Subsequent time-entry changes adjust this total by their duration difference.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ timeEntry: ["update"] }),
  ] as const,
  request: {
    params: taskIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: setTaskTimeBody } },
    },
  },
  responses: {
    200: jsonResponse("Task time total", taskTimeSchema),
    400: errorResponse("Invalid duration"),
    403: errorResponse(
      "No access to the project, or missing timeEntry:update permission",
    ),
    404: errorResponse("Task not found"),
  },
});

const timeEntry = apiRouter()
  .route("/", worklogs)
  .openapi(getTaskTimeRoute, async (c) =>
    c.json(await getTaskTime(c.req.valid("param").taskId), 200),
  )
  .openapi(setTaskTimeRoute, async (c) =>
    c.json(
      await setTaskTime(
        c.req.valid("param").taskId,
        c.req.valid("json").totalSeconds,
      ),
      200,
    ),
  )
  .openapi(getTaskTimeEntriesRoute, async (c) =>
    c.json(await getTimeEntriesByTaskId(c.req.valid("param").taskId), 200),
  )
  .openapi(getTimeEntryRoute, async (c) =>
    c.json(await getTimeEntry(c.req.valid("param").id), 200),
  )
  .openapi(createTimeEntryRoute, async (c) => {
    const { taskId, startTime, endTime, description } = c.req.valid("json");
    return c.json(
      await createTimeEntry({
        taskId,
        userId: c.get("userId"),
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        description,
      }),
      200,
    );
  })
  .openapi(updateTimeEntryRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { startTime, endTime, description } = c.req.valid("json");
    return c.json(
      await updateTimeEntry({
        timeEntryId: id,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        description,
      }),
      200,
    );
  });

export default timeEntry;
