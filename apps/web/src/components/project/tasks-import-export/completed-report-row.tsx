import { Clock3 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import { CompletedReportDialog } from "./completed-report-dialog";

export function CompletedReportRow({
  project,
}: {
  project: { id: string; slug: string };
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow
        icon={<Clock3 />}
        title={t("settings:timeReport.title")}
        description={t("settings:timeReport.description")}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-24"
          aria-label={t("settings:timeReport.export")}
          onClick={() => setOpen(true)}
        >
          {t("settings:tasksImportExport.export")}
        </Button>
      </SettingsRow>
      {open && (
        <CompletedReportDialog
          project={project}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
