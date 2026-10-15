import { format, startOfMonth } from "date-fns";
import { saveAs } from "file-saver";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";
import { useExportCompletedTasks } from "@/hooks/mutations/task/use-export-completed-tasks";
import { toast } from "@/lib/toast";
import { completedReportPeriod } from "./completed-report-period";

export function CompletedReportDialog({
  project,
  open,
  onOpenChange,
}: {
  project: { id: string; slug: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const fromId = useId();
  const toId = useId();
  const [from, setFrom] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [error, setError] = useState("");
  const exportReport = useExportCompletedTasks();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md">
        <form
          className="contents"
          onSubmit={async (event) => {
            event.preventDefault();
            if (exportReport.isPending) return;
            const period = completedReportPeriod(from, to);
            if (!period) {
              setError(t("settings:timeReport.invalidPeriod"));
              return;
            }
            try {
              setError("");
              const report = await exportReport.mutateAsync({
                projectId: project.id,
                ...period,
              });
              saveAs(
                new Blob([JSON.stringify(report, null, 2)], {
                  type: "application/json",
                }),
                `${project.slug}-completed-${from}-${to}.json`,
              );
              if (report.summary.unknownCompletionCount)
                toast.warning(
                  t("settings:timeReport.unknownDates", {
                    count: report.summary.unknownCompletionCount,
                  }),
                );
              onOpenChange(false);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : t("settings:timeReport.exportError"),
              );
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("settings:timeReport.title")}</DialogTitle>
            <DialogDescription>
              {t("settings:timeReport.details")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field className="min-w-0">
                <FieldLabel id={`${fromId}-label`} htmlFor={fromId}>
                  {t("settings:timeReport.from")}
                </FieldLabel>
                <DatePicker
                  id={fromId}
                  labelledBy={`${fromId}-label`}
                  value={from}
                  onValueChange={setFrom}
                  max={to || undefined}
                  disabled={exportReport.isPending}
                />
              </Field>
              <Field className="min-w-0">
                <FieldLabel id={`${toId}-label`} htmlFor={toId}>
                  {t("settings:timeReport.to")}
                </FieldLabel>
                <DatePicker
                  id={toId}
                  labelledBy={`${toId}-label`}
                  value={to}
                  onValueChange={setTo}
                  min={from || undefined}
                  disabled={exportReport.isPending}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settings:timeReport.timeZone", {
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              })}
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive-foreground">
                {error}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={exportReport.isPending}
                />
              }
            >
              {t("common:actions.cancel")}
            </DialogClose>
            <Button type="submit" disabled={exportReport.isPending}>
              {t("settings:timeReport.download")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
