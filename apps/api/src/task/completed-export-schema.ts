import { responseTimestamp, z } from "../openapi";
import { timeEntryListSchema } from "../time-entry/response";
import {
  reportCategoryQuery,
  reportCategoryFieldSchema,
} from "./report-category";
import { timestamp } from "../time-entry/schema";

export const completedExportQuery = z
  .object({
    ...reportCategoryQuery,
    from: timestamp.openapi({ description: "Inclusive completion timestamp." }),
    to: timestamp.openapi({ description: "Exclusive completion timestamp." }),
    timeZone: z
      .string()
      .max(100)
      .default("UTC")
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Invalid time zone"),
  })
  .refine((value) => Date.parse(value.from) < Date.parse(value.to), {
    message: "The end of the period must follow its start.",
    path: ["to"],
  });

export const completedExportSchema = z
  .object({
    version: z.literal(1),
    exportedAt: responseTimestamp,
    categoryField: reportCategoryFieldSchema,
    project: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
    period: z.object({
      from: responseTimestamp,
      to: responseTimestamp,
      timeZone: z.string(),
    }),
    summary: z.object({
      taskCount: z.number(),
      totalSeconds: z.number(),
      runningEntryCount: z.number(),
      unknownCompletionCount: z.number(),
    }),
    tasks: z.array(
      z.object({
        id: z.string(),
        ticketId: z.string(),
        title: z.string(),
        category: z.string().nullable(),
        description: z.string().nullable(),
        status: z.string(),
        completedAt: responseTimestamp,
        assigneeId: z.string().nullable(),
        assigneeName: z.string().nullable(),
        totalSeconds: z.number(),
        timeEntries: timeEntryListSchema,
      }),
    ),
  })
  .openapi("CompletedTasksTimeReport");
