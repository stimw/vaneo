import { useTranslation } from "react-i18next";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportSummary } from "./report-values";
import { ReportCategoryChart } from "./report-category-chart";

export function ReportCategories({
  fields,
  fieldId,
  category,
  report,
  pending = false,
  error = false,
  onRetry,
  onChange,
}: {
  fields: { id: string; name: string; options: unknown }[];
  fieldId?: string;
  category?: string;
  report?: ReportSummary;
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onChange: (fieldId: string, category?: string) => void;
}) {
  const { t } = useTranslation();
  const selected = fields.find((field) => field.id === fieldId);
  const options = Array.isArray(selected?.options)
    ? selected.options.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const fieldItems = [
    { value: "", label: t("tasks:reports.noGrouping") },
    ...fields.map((field) => ({ value: field.id, label: field.name })),
  ];
  return (
    <section
      className="border-b px-5 py-5 sm:px-7"
      aria-label={t("tasks:reports.categories")}
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-medium">
              {t("tasks:reports.categories")}
            </h2>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t("tasks:reports.howCalculated")}
                  />
                }
              >
                <Info className="size-3.5" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipPopup className="max-w-72">
                {t("tasks:reports.categoryHint")}
              </TooltipPopup>
            </Tooltip>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("tasks:reports.categoryComparisonHint")}
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <label htmlFor="report-category-field" className="sr-only">
            {t("tasks:reports.groupBy")}
          </label>
          <Select
            items={fieldItems}
            value={fieldId ?? ""}
            onValueChange={(value) => {
              if (value !== null) onChange(value);
            }}
          >
            <SelectTrigger
              id="report-category-field"
              size="sm"
              className="w-48 max-w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {fieldItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      </div>
      {selected && category !== undefined && (
        <div
          className="mt-4 flex flex-wrap items-center gap-2 text-xs"
          role="status"
        >
          <span className="text-muted-foreground">
            {t("tasks:reports.showingCategory")}
          </span>
          <Button
            size="xs"
            variant="secondary"
            onClick={() => onChange(selected.id, undefined)}
            aria-label={t("tasks:reports.clearCategory")}
          >
            {category || t("tasks:reports.uncategorized")}
            <X className="size-3" aria-hidden="true" />
          </Button>
        </div>
      )}
      {selected &&
        (error ? (
          <div
            role="alert"
            className="flex items-center gap-3 py-8 text-sm text-muted-foreground"
          >
            {t("tasks:reports.loadFailed")}
            <Button variant="outline" size="sm" onClick={onRetry}>
              {t("tasks:reports.retry")}
            </Button>
          </div>
        ) : pending || !report ? (
          <div className="grid gap-5 pt-5 sm:grid-cols-[200px_1fr]">
            <Skeleton className="mx-auto size-44 rounded-full" />
            <div className="space-y-3">
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <ReportCategoryChart
            options={options}
            totals={report.categories}
            selected={category}
            onSelect={(value) => onChange(selected.id, value)}
          />
        ))}
    </section>
  );
}
