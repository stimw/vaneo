import { updateUploadSettings } from "../config/upload-settings";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireInstanceAdmin } from "../utils/require-instance-admin";
import { requireUserSession } from "../utils/require-user-session";

const uploadSettingsSchema = z.object({
  maxUploadBytes: z.number().int().min(1048576).max(1073741824).openapi({
    description:
      "Maximum size of one task attachment or project background in bytes, from 1 MiB to 1 GiB. Images are checked after browser compression. Reverse proxy and storage limits still apply.",
  }),
});

const updateUploadSettingsRoute = createRoute({
  method: "put",
  operationId: "updateUploadSettings",
  path: "/upload-settings",
  tags: ["Admin"],
  summary: "Set the instance upload limit",
  description:
    "Persist a per-file upload limit for every workspace. Takes effect on new upload requests immediately and overrides S3_MAX_IMAGE_UPLOAD_BYTES. Existing attachments are unchanged. Requires an instance administrator session; API keys are rejected.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: uploadSettingsSchema } },
    },
  },
  responses: {
    200: jsonResponse("Saved upload limit", uploadSettingsSchema),
    400: errorResponse("Invalid upload limit"),
    403: errorResponse("An instance administrator session is required"),
  },
});

export const uploadSettings = apiRouter().openapi(
  updateUploadSettingsRoute,
  async (c) =>
    c.json(await updateUploadSettings(c.req.valid("json").maxUploadBytes), 200),
);
