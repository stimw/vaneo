import { responseTimestamp, z } from "../openapi";
import {
  completedExportQuery,
  completedExportSchema,
} from "./completed-export-schema";

export const completedReportFilters = completedExportQuery.safeExtend({
  search: z.string().trim().max(200).default(""),
  day: z.iso
    .date()
    .optional()
    .openapi({ description: "Completion day in the supplied time zone." }),
  zeroOnly: z.enum(["true", "false"]).default("false"),
  sort: z.enum(["completed", "time"]).default("completed"),
});

export const completedReportPageQuery = completedReportFilters.safeExtend({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const completedReportExportQuery = completedExportQuery.safeExtend({
  search: completedReportFilters.shape.search.removeDefault().optional(),
  day: completedReportFilters.shape.day,
  zeroOnly: completedReportFilters.shape.zeroOnly.removeDefault().optional(),
  sort: completedReportFilters.shape.sort.removeDefault().optional(),
});

export type CompletedReportFilters = z.infer<typeof completedReportFilters>;
export type CompletedReportPageQuery = z.infer<typeof completedReportPageQuery>;

const reportTask = completedExportSchema.shape.tasks.element.omit({
  description: true,
  timeEntries: true,
});
const totals = z.object({
  taskCount: z.number(),
  totalSeconds: z.number(),
  zeroCount: z.number(),
});

export const completedReportSummarySchema = z
  .object({
    generatedAt: responseTimestamp,
    project: completedExportSchema.shape.project,
    period: completedExportSchema.shape.period,
    summary: totals.extend({ unknownCompletionCount: z.number() }),
    activity: z.array(
      z.object({
        date: z.string(),
        taskCount: z.number(),
        totalSeconds: z.number(),
      }),
    ),
    topTasks: z.array(reportTask),
  })
  .openapi("CompletedTaskReportSummary");

export const completedReportPageSchema = z
  .object({
    tasks: z.array(reportTask),
    summary: totals,
    page: z.number(),
    limit: z.number(),
    nextPage: z.number().nullable(),
  })
  .openapi("CompletedTaskReportPage");
