import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { UploadSettingsPanel } from "@/components/admin/uploads/upload-settings-panel";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/uploads",
)({ component: UploadSettingsPage });

function UploadSettingsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title={t("settings:adminUploads.title")} />
      <UploadSettingsPanel />
    </>
  );
}
