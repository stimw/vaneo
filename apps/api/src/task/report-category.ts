import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
} from "../database/schema";
import { z } from "../openapi";
import type { TaskReadDatabase } from "./bounded-read";

export const reportCategoryQuery = {
  categoryFieldId: z.string().min(1).max(200).optional().openapi({
    description:
      "Project single-select custom field used for mutually exclusive time categories.",
  }),
  category: z.string().max(500).optional().openapi({
    description:
      "Filter by the selected field's value. Empty string selects uncategorized tasks. Requires categoryFieldId.",
  }),
};
export type ReportCategoryQuery = {
  categoryFieldId?: string;
  category?: string;
};
export const reportCategoryFieldSchema = z
  .object({ id: z.string(), name: z.string(), options: z.array(z.string()) })
  .nullable();
export const reportCategoryTotalsSchema = z.array(
  z.object({
    category: z.string().nullable(),
    taskCount: z.number(),
    totalSeconds: z.number(),
  }),
);

export async function resolveReportCategory(
  tx: TaskReadDatabase,
  projectId: string,
  query: ReportCategoryQuery,
) {
  if (!query.categoryFieldId) {
    if (query.category !== undefined)
      throw new HTTPException(400, {
        message: "Choose a category field before filtering",
      });
    return {
      field: null,
      value: sql<string | null>`null::text`,
      where: sql`true`,
    };
  }
  const field = await tx.query.customFieldDefinitionTable.findFirst({
    where: and(
      eq(customFieldDefinitionTable.id, query.categoryFieldId),
      eq(customFieldDefinitionTable.projectId, projectId),
    ),
  });
  if (!field)
    throw new HTTPException(404, {
      message: "Category field not found in this project",
    });
  if (field.type !== "dropdown")
    throw new HTTPException(400, {
      message: "Time categories require a single-select field",
    });
  const options = Array.isArray(field.options)
    ? field.options.filter((v): v is string => typeof v === "string")
    : [];
  if (query.category && !options.includes(query.category))
    throw new HTTPException(400, { message: "Invalid category" });
  // The unique (task_id, field_id) constraint guarantees one bucket per task.
  // A scalar subquery avoids multiplying task time by other fields or labels.
  const value = sql<
    string | null
  >`(select nullif(category_value.value, '') from ${customFieldValueTable} as category_value where category_value.task_id = ${taskTable}."id" and category_value.field_id = ${field.id})`;
  const where =
    query.category === undefined
      ? sql`true`
      : query.category === ""
        ? sql`${value} is null`
        : sql`${value} = ${query.category}`;
  return { field: { id: field.id, name: field.name, options }, value, where };
}
