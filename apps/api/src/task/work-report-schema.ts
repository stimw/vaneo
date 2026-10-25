import {
  reportCategoryFieldSchema,
  reportCategoryTotalsSchema,
} from "./report-category";
import { responseTimestamp, z } from "../openapi";
import { completedExportSchema } from "./completed-export-schema";

export const workReportTaskSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  completedAt: responseTimestamp.nullable(),
  loggedAt: z.string(),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  totalSeconds: z.number(),
  trackedSeconds: z.number(),
  estimatedSeconds: z.number().nullable(),
  progress: z.number().nullable(),
});
export const workReportSchema = z
  .object({
    generatedAt: responseTimestamp,
    categoryField: reportCategoryFieldSchema,
    categories: reportCategoryTotalsSchema,
    project: completedExportSchema.shape.project,
    period: completedExportSchema.shape.period,
    summary: z.object({
      taskCount: z.number(),
      totalSeconds: z.number(),
      zeroCount: z.number(),
      unknownCompletionCount: z.number(),
    }),
    activity: z.array(
      z.object({
        date: z.string(),
        taskCount: z.number(),
        totalSeconds: z.number(),
      }),
    ),
    topTasks: z.array(workReportTaskSchema),
    tasks: z.array(workReportTaskSchema),
    page: z.number(),
    limit: z.number(),
    nextPage: z.number().nullable(),
  })
  .openapi("LoggedTimeReport");
