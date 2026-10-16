import { useMutation } from "@tanstack/react-query";
import { saveAs } from "file-saver";
import { Braces, ChevronDown, Download, FileSpreadsheet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { exportCompletedTasks } from "@/fetchers/task/export-completed-tasks";
import type { ReportPeriod } from "@/fetchers/task/get-completed-report";
import type { ReportFilters } from "@/fetchers/task/get-completed-report-page";
import { toast } from "@/lib/toast";
import { reportCsv } from "./report-csv";

export function ReportExportMenu({
  projectId,
  period,
  from,
  to,
  disabled,
  filters,
}: {
  projectId: string;
  period: ReportPeriod;
  from: string;
  to: string;
  disabled: boolean;
  filters: ReportFilters;
}) {
  const { t } = useTranslation();
  const download = useMutation({
    mutationFn: async (format: "csv" | "json") => {
      // Export all matching rows only when requested, independently of loaded pages.
      const report = await exportCompletedTasks(projectId, period, filters);
      const filename = `${report.project.slug}-${from}-${to}`;
      saveAs(
        new Blob(
          [
            format === "csv"
              ? reportCsv(report.tasks)
              : JSON.stringify({ ...report, view: filters }, null, 2),
          ],
          {
            type:
              format === "csv" ? "text/csv;charset=utf-8" : "application/json",
          },
        ),
        `${filename}.${format}`,
      );
    },
    onError: () => toast.error(t("tasks:reports.exportFailed")),
  });
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            loading={download.isPending}
          />
        }
      >
        <Download aria-hidden="true" />
        {t("tasks:reports.exportView")}
        <ChevronDown aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-52">
        <MenuItem onClick={() => download.mutate("csv")}>
          <FileSpreadsheet aria-hidden="true" />
          {t("tasks:reports.exportCsv")}
        </MenuItem>
        <MenuItem onClick={() => download.mutate("json")}>
          <Braces aria-hidden="true" />
          {t("tasks:reports.exportJson")}
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
